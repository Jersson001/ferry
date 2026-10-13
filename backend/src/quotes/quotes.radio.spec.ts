import { QuotesService } from './quotes.service';

const chia = { lat: 4.8587, lng: -74.0326 };
const solicitud = (id: string, radioKm: number, lat?: number, lng?: number) => ({ id, radioKm, userLat: lat, userLng: lng });

const armar = (tienda: any, solicitudes: any[]) => {
  const qb: any = {};
  for (const m of ['where', 'andWhere', 'orderBy']) qb[m] = jest.fn(() => qb);
  qb.getMany = jest.fn(async () => solicitudes);
  const requestRepository: any = { createQueryBuilder: jest.fn(() => qb) };
  const quoteRepository: any = { find: jest.fn(async () => []) };
  const dataSource: any = { getRepository: () => ({ findOne: async () => ({ uid: 't1', specialties: ['Plomería'], ...tienda }) }) };
  return new QuotesService(requestRepository, quoteRepository, dataSource);
};

describe('Solicitudes dentro del radio del cliente', () => {
  const lejos10 = solicitud('lejos', 10, 4.711, -74.0721); // ~16 km
  const lejos20 = solicitud('cerca', 20, 4.711, -74.0721);
  const sinUbicacion = solicitud('sin', 5);

  it('la tienda solo ve las solicitudes cuyo radio la alcanza, con la distancia', async () => {
    const service = armar({ location: chia }, [lejos10, lejos20, sinUbicacion]);
    const ids = (await service.getPendingRequests('t1')).map((r: any) => r.id);
    expect(ids).toEqual(['cerca', 'sin']);
    const cerca: any = (await service.getPendingRequests('t1')).find((r: any) => r.id === 'cerca');
    expect(cerca.distanceKm).toBeGreaterThan(15);
  });

  it('una tienda sin coordenadas no se queda sin servicio', async () => {
    const service = armar({ location: { address: 'Calle 1' } }, [lejos10, lejos20]);
    expect(await service.getPendingRequests('t1')).toHaveLength(2);
  });

  it('el contador cuenta lo mismo que la bandeja', async () => {
    const service = armar({ location: chia }, [lejos10, lejos20, sinUbicacion]);
    expect(await service.getPendingRequestsCount('t1')).toBe(2);
  });
});
