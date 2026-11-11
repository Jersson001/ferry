import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { RequestStatus } from './entities/material-request.entity';

// Solicitud de Plomería abierta; la tienda tiene la especialidad 'Plomería'.
const armar = (opts: { cotizacionesDeLaTienda?: number; delDia?: number; recibidasAlGuardar?: number; plan?: any } = {}) => {
  const quoteRepository: any = {
    count: jest.fn(async ({ where }: any) => ('requestId' in where ? opts.cotizacionesDeLaTienda ?? 0 : opts.delDia ?? 0)),
    create: jest.fn((x) => x),
  };
  const requestRepository: any = {
    findOne: jest.fn(async () => ({ id: 'r1', status: RequestStatus.OPEN, category: 'Plomería' })),
  };
  const manager = {
    findOne: jest.fn(),
    count: jest.fn(async () => opts.recibidasAlGuardar ?? 0),
    save: jest.fn(async (_c, q) => q),
  };
  // planVigente consulta el rol, la suscripción y, si no hay plan de pago vigente, el gratuito de tiendas.
  const gratuito = { name: 'Gratuito', targetRole: 'STORE', priceInCents: 0, maxQuotesPerDay: 5 };
  const dataSource: any = {
    getRepository: (entidad: any) => {
      if (entidad.name === 'User') return { findOne: async () => ({ uid: 't1', specialties: ['Plomería'] }) };
      return { create: (x: any) => x };
    },
    manager: {
      findOne: async (entidad: any) => {
        if (entidad.name === 'User') return { uid: 't1', role: 'STORE' };
        if (entidad.name === 'UserSubscription') return opts.plan ?? null;
        return gratuito;
      },
    },
    transaction: async (fn: any) => fn(manager),
  };
  return { service: new QuotesService(requestRepository, quoteRepository, dataSource), manager };
};

const cotizacion = { items: [{ name: 'Tubo', quantity: 2, storeBaseUnitPrice: 1000, unit: 'und' }] };

describe('createQuote — topes', () => {
  it('guarda la cotización cuando hay cupo', async () => {
    const { service, manager } = armar();
    await service.createQuote('t1', 'r1', cotizacion);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('rechaza precios inválidos antes de calcular nada', async () => {
    const { service } = armar();
    await expect(service.createQuote('t1', 'r1', { items: [{ quantity: 1, storeBaseUnitPrice: -1 }] })).rejects.toThrow(BadRequestException);
  });

  it('no deja cotizar dos veces la misma solicitud', async () => {
    const { service } = armar({ cotizacionesDeLaTienda: 1 });
    await expect(service.createQuote('t1', 'r1', cotizacion)).rejects.toThrow(ConflictException);
  });

  it('sin plan de pago, la sexta cotización del día se rechaza', async () => {
    const { service } = armar({ delDia: 5 });
    await expect(service.createQuote('t1', 'r1', cotizacion)).rejects.toThrow(ForbiddenException);
  });

  const enUnMes = new Date(Date.now() + 30 * 86_400_000);
  const suscripcion = (maxQuotesPerDay: number, vence: Date = enUnMes) => ({
    status: 'ACTIVE', currentPeriodEnd: vence,
    plan: { name: 'Plan', targetRole: 'STORE', priceInCents: 6000000, maxQuotesPerDay, hasVerifiedBadge: true },
  });

  it('el plan Profesional (40 al día) deja enviar la cotización 40', async () => {
    const { service, manager } = armar({ delDia: 39, plan: suscripcion(40) });
    await service.createQuote('t1', 'r1', cotizacion);
    expect(manager.save).toHaveBeenCalled();
  });

  it('el plan Profesional rechaza la cotización 41 del día', async () => {
    const { service } = armar({ delDia: 40, plan: suscripcion(40) });
    await expect(service.createQuote('t1', 'r1', cotizacion)).rejects.toThrow(ForbiddenException);
  });

  it('un plan sin tope diario (-1) deja cotizar siempre', async () => {
    const { service, manager } = armar({ delDia: 500, plan: suscripcion(-1) });
    await service.createQuote('t1', 'r1', cotizacion);
    expect(manager.save).toHaveBeenCalled();
  });

  it('un plan de pago vencido vuelve al tope del gratuito', async () => {
    const { service } = armar({ delDia: 5, plan: suscripcion(40, new Date(Date.now() - 86_400_000)) });
    await expect(service.createQuote('t1', 'r1', cotizacion)).rejects.toThrow(ForbiddenException);
  });

  it('si la solicitud ya tiene sus 5 cotizaciones, la tienda que llega tarde no entra', async () => {
    const { service, manager } = armar({ recibidasAlGuardar: 5 });
    await expect(service.createQuote('t1', 'r1', cotizacion)).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('con 4 cotizaciones aún entra la quinta', async () => {
    const { service, manager } = armar({ recibidasAlGuardar: 4 });
    await service.createQuote('t1', 'r1', cotizacion);
    expect(manager.save).toHaveBeenCalled();
  });
});
