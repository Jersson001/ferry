import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService, articulosDeLista, ARCHIVABLE_DESDE_MS } from './quotes.service';
import { RequestStatus } from './entities/material-request.entity';

const HORA = 60 * 60 * 1000;
const items = [{ name: 'Cemento 50 kg', quantity: '2', unit: 'bulto', nombreComercial: 'Argos' }];

const armar = (solicitud: any, cotizacionesEnCurso = 0) => {
  const guardadas: any[] = [];
  const requestRepository: any = {
    findOne: jest.fn(async () => solicitud),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => { guardadas.push({ ...x }); return { id: x.id ?? 'nueva', ...x }; }),
  };
  const quoteRepository: any = { count: jest.fn(async () => cotizacionesEnCurso) };
  const dataSource: any = { manager: { findOne: jest.fn(async () => null) } };
  const push: any = { avisarSolicitud: jest.fn(async () => 1) };
  return { service: new QuotesService(requestRepository, quoteRepository, dataSource, push), guardadas, push };
};

const vieja = () => ({ id: 'r1', userId: 'cliente', status: RequestStatus.OPEN, title: 'Pedido Depósito', category: 'Depósito', items, createdAt: new Date(Date.now() - 49 * HORA) });

describe('Solicitudes de más de 48 horas', () => {
  it('se puede borrar: queda cancelada', async () => {
    const { service, guardadas } = armar(vieja());
    await service.borrarSolicitud('r1', 'cliente');
    expect(guardadas[0].status).toBe(RequestStatus.CANCELLED);
  });

  it('antes de 48 horas no se puede borrar', async () => {
    const { service } = armar({ ...vieja(), createdAt: new Date(Date.now() - 47 * HORA) });
    await expect(service.borrarSolicitud('r1', 'cliente')).rejects.toThrow('48 horas');
  });

  it('las 48 horas cuentan desde que se volvió a enviar', async () => {
    const { service } = armar({ ...vieja(), publishedAt: new Date(Date.now() - 2 * HORA) });
    await expect(service.borrarSolicitud('r1', 'cliente')).rejects.toThrow(BadRequestException);
  });

  it('con una cotización aceptada o pagada no se puede borrar', async () => {
    const { service } = armar(vieja(), 1);
    await expect(service.borrarSolicitud('r1', 'cliente')).rejects.toThrow('aceptada');
  });

  it('otra cuenta no puede borrarla', async () => {
    const { service } = armar(vieja());
    await expect(service.borrarSolicitud('r1', 'otra')).rejects.toThrow(NotFoundException);
  });

  it('guardarla crea una lista (borrador) con los mismos artículos y cancela la solicitud', async () => {
    const { service, guardadas } = armar(vieja());
    const lista = await service.guardarComoLista('r1', 'cliente');
    expect(lista.status).toBe(RequestStatus.DRAFT);
    expect(lista.items).toEqual(items);
    expect(lista.title).toBe('Pedido Depósito');
    expect(guardadas[1].status).toBe(RequestStatus.CANCELLED);
  });

  it('la vigencia de 48 h es exacta', () => expect(ARCHIVABLE_DESDE_MS).toBe(48 * HORA));
});

describe('Listas guardadas', () => {
  const lista = () => ({ id: 'l1', userId: 'cliente', status: RequestStatus.DRAFT, title: 'Pedido Depósito', category: 'Depósito', items, createdAt: new Date() });

  it('se editan nombre y artículos, conservando los demás datos del artículo', async () => {
    const { service } = armar(lista());
    const l = await service.editarLista('l1', 'cliente', { title: ' Obra casa ', items: [{ ...items[0], quantity: 5 }, { name: 'Arena', quantity: '3' }] });
    expect(l.title).toBe('Obra casa');
    expect(l.items).toEqual([
      { name: 'Cemento 50 kg', quantity: '5', unit: 'bulto', nombreComercial: 'Argos' },
      { name: 'Arena', quantity: '3', unit: 'und' },
    ]);
  });

  it('enviarla publica una solicitud nueva y avisa a las ferreterías', async () => {
    const { service, guardadas, push } = armar(lista());
    const nueva = await service.enviarLista('l1', 'cliente');
    expect(nueva.status).toBe(RequestStatus.OPEN);
    expect(nueva.items).toEqual(items);
    expect(guardadas.find(g => g.status === RequestStatus.DRAFT)).toBeUndefined(); // la lista no se modifica
    expect(push.avisarSolicitud).toHaveBeenCalledTimes(1);
  });

  it('una solicitud abierta no se edita como lista', async () => {
    const { service } = armar({ ...lista(), status: RequestStatus.OPEN });
    await expect(service.editarLista('l1', 'cliente', { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('otra cuenta no puede enviarla', async () => {
    const { service } = armar(lista());
    await expect(service.enviarLista('l1', 'otra')).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['sin artículos', []],
    ['artículo sin nombre', [{ name: ' ', quantity: 1 }]],
    ['cantidad cero', [{ name: 'Arena', quantity: 0 }]],
    ['cantidad con texto', [{ name: 'Arena', quantity: 'muchos' }]],
  ])('rechaza una lista %s', (_caso, valor) => {
    expect(() => articulosDeLista(valor)).toThrow(BadRequestException);
  });
});
