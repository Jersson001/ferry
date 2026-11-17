import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { RequestStatus } from './entities/material-request.entity';
import { solicitudVigente, VIGENCIA_SOLICITUD_MS } from './cupos';

const MIN = 60 * 1000;

describe('vigencia de las solicitudes (1 hora)', () => {
  it('cuenta desde que se creó', () => {
    expect(solicitudVigente({ createdAt: new Date(Date.now() - 59 * MIN) })).toBe(true);
    expect(solicitudVigente({ createdAt: new Date(Date.now() - 61 * MIN) })).toBe(false);
  });

  it('volver a enviarla reinicia la hora', () => {
    expect(solicitudVigente({ createdAt: new Date(Date.now() - 50 * 24 * 60 * MIN), publishedAt: new Date(Date.now() - 10 * MIN) })).toBe(true);
  });

  it('la vigencia es de exactamente una hora', () => expect(VIGENCIA_SOLICITUD_MS).toBe(60 * MIN));
});

describe('QuotesService.republicarSolicitud', () => {
  const armar = (solicitud: any) => {
    const requestRepository: any = {
      findOne: jest.fn(async () => solicitud),
      save: jest.fn(async (r) => r),
    };
    const push: any = { avisarSolicitud: jest.fn(async () => 1) };
    return { service: new QuotesService(requestRepository, {} as any, {} as any, push), requestRepository, push };
  };
  const vencida = () => ({ id: 'r1', userId: 'cliente', status: RequestStatus.OPEN, createdAt: new Date(Date.now() - 2 * 60 * MIN) });

  it('vuelve a publicar una solicitud vencida y avisa a las ferreterías', async () => {
    const { service, push } = armar(vencida());
    const r = await service.republicarSolicitud('r1', 'cliente');
    expect(r.vencida).toBe(false);
    expect(Date.now() - r.publishedAt!.getTime()).toBeLessThan(5000);
    expect(push.avisarSolicitud).toHaveBeenCalledTimes(1);
  });

  it('otro usuario no puede volver a enviarla', async () => {
    const { service } = armar(vencida());
    await expect(service.republicarSolicitud('r1', 'otro')).rejects.toThrow(NotFoundException);
  });

  it('una que sigue publicada no se reenvía', async () => {
    const { service } = armar({ ...vencida(), createdAt: new Date(Date.now() - 10 * MIN) });
    await expect(service.republicarSolicitud('r1', 'cliente')).rejects.toThrow(BadRequestException);
  });

  it('una cancelada o completada no se reenvía', async () => {
    const { service } = armar({ ...vencida(), status: RequestStatus.COMPLETED });
    await expect(service.republicarSolicitud('r1', 'cliente')).rejects.toThrow(BadRequestException);
  });

  it('el cliente ve cuáles vencieron', async () => {
    const requestRepository: any = {
      find: jest.fn(async () => [
        { id: 'a', status: RequestStatus.OPEN, createdAt: new Date(Date.now() - 2 * 60 * MIN) },
        { id: 'b', status: RequestStatus.OPEN, createdAt: new Date(Date.now() - 5 * MIN) },
        { id: 'c', status: RequestStatus.COMPLETED, createdAt: new Date(Date.now() - 2 * 60 * MIN) },
      ]),
    };
    const service = new QuotesService(requestRepository, {} as any, {} as any);
    const lista = await service.getOwnRequests('cliente');
    expect(lista.map(r => [r.id, r.vencida])).toEqual([['a', true], ['b', false], ['c', false]]);
  });
});
