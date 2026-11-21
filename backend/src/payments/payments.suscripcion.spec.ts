import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment-transaction.entity';

const USUARIO = '811d62f5-b226-43b4-89af-c7e271246b0a';
const PLAN = '2c3174af-699b-4887-95c5-e081734ef228';
const REF = `SUB_${USUARIO}_${PLAN}_1795137885798`;

const armar = (opts: { existente?: any; wompi?: any } = {}) => {
  const guardadas: any[] = [];
  const transactionRepository: any = {
    findOne: jest.fn(async () => opts.existente ?? null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => { guardadas.push(x); return x; }),
  };
  const configService: any = { get: jest.fn((k: string) => (k === 'WOMPI_ENV' ? 'sandbox' : undefined)) };
  const subscriptionsService: any = {
    getPlans: jest.fn(async () => [{ id: PLAN, priceInCents: 3_000_000 }]),
    purchasePlan: jest.fn(async () => ({})),
  };
  global.fetch = jest.fn(async () => ({ json: async () => ({ data: opts.wompi }) })) as any;
  const service = new PaymentsService(transactionRepository, {} as any, configService, subscriptionsService, {} as any, {} as any);
  return { service, subscriptionsService, guardadas };
};

const aprobada = { id: 'tx-1', status: 'APPROVED', reference: REF, amount_in_cents: 3_000_000, currency: 'COP', payment_method_type: 'CARD' };

describe('Confirmar el pago de un plan (verifyWompiSubscriptionTransaction)', () => {
  const fetchReal = global.fetch;
  afterEach(() => { global.fetch = fetchReal; });

  it('un pago aprobado por Wompi activa el plan una vez y lo registra', async () => {
    const { service, subscriptionsService, guardadas } = armar({ wompi: aprobada });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', USUARIO)).resolves.toEqual({ success: true });
    expect(subscriptionsService.purchasePlan).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.purchasePlan).toHaveBeenCalledWith(USUARIO, PLAN);
    expect(guardadas).toHaveLength(1);
  });

  it('si el pago ya estaba registrado (llegó el aviso de Wompi o se confirmó antes) no lo activa otra vez', async () => {
    const { service, subscriptionsService } = armar({ existente: { transactionId: 'tx-1', reference: REF, status: PaymentStatus.APPROVED } });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', USUARIO)).resolves.toEqual({ success: true });
    expect(subscriptionsService.purchasePlan).not.toHaveBeenCalled();
  });

  it('una transacción registrada de otra cuenta se rechaza', async () => {
    const { service } = armar({ existente: { transactionId: 'tx-1', reference: REF, status: PaymentStatus.APPROVED } });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', 'otra-cuenta')).rejects.toThrow(BadRequestException);
  });

  it('un pago de otra cuenta se rechaza sin activar nada', async () => {
    const { service, subscriptionsService } = armar({ wompi: aprobada });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', 'otra-cuenta')).rejects.toThrow(BadRequestException);
    expect(subscriptionsService.purchasePlan).not.toHaveBeenCalled();
  });

  it('un pago que Wompi no aprobó no activa nada', async () => {
    const { service, subscriptionsService } = armar({ wompi: { ...aprobada, status: 'DECLINED' } });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', USUARIO)).rejects.toThrow('no ha sido aprobado');
    expect(subscriptionsService.purchasePlan).not.toHaveBeenCalled();
  });

  it('un pago por menos del valor del plan se rechaza', async () => {
    const { service, subscriptionsService } = armar({ wompi: { ...aprobada, amount_in_cents: 100 } });
    await expect(service.verifyWompiSubscriptionTransaction('tx-1', USUARIO)).rejects.toThrow('monto');
    expect(subscriptionsService.purchasePlan).not.toHaveBeenCalled();
  });

  it('sin transacción se rechaza', async () => {
    const { service } = armar();
    await expect(service.verifyWompiSubscriptionTransaction('', USUARIO)).rejects.toThrow(BadRequestException);
  });
});
