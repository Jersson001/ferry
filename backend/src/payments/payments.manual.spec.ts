import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment-transaction.entity';
import { QuoteStatus } from '../quotes/entities/quote.entity';

const CLIENTE = 'cliente-1';
const QUOTE = '6f1c2a10-1111-4222-8333-944455556666';

const armar = (opts: { tx?: any; affected?: number; payQuoteFalla?: boolean; fotoFalla?: boolean } = {}) => {
  const guardadas: any[] = [];
  const updates: any[] = [];
  const transactionRepository: any = {
    findOne: jest.fn(async () => opts.tx ?? null),
    create: jest.fn((x) => ({ id: 'tx-manual', ...x })),
    save: jest.fn(async (x) => { guardadas.push(x); return x; }),
    update: jest.fn(async (where, set) => { updates.push({ where, set }); return { affected: opts.affected ?? 1 }; }),
  };
  const quotesService: any = {
    marcarEnValidacion: jest.fn(async () => ({ antes: QuoteStatus.ACCEPTED, clientFinalTotal: 150000 })),
    quitarValidacion: jest.fn(async () => undefined),
    avisarComprobanteRechazado: jest.fn(async () => undefined),
    payQuote: jest.fn(async () => { if (opts.payQuoteFalla) throw new Error('estado'); return {}; }),
  };
  const storage: any = {
    saveBase64Image: jest.fn(async () => { if (opts.fotoFalla) throw new Error('Formato de imagen base64 inválido.'); return 'https://x/comprobantes/a.webp'; }),
  };
  const service = new PaymentsService(transactionRepository, quotesService, {} as any, {} as any, {} as any, storage);
  return { service, quotesService, storage, guardadas, updates };
};

describe('Pago manual por Nequi: el comprobante no paga el pedido por sí solo', () => {
  it('deja el pedido en revisión y guarda la transacción PENDING con el monto esperado, sin pagar', async () => {
    const { service, quotesService, guardadas } = armar();
    await service.processManualPayment(QUOTE, 'M123', 'aGVsbG8=', CLIENTE);
    expect(quotesService.payQuote).not.toHaveBeenCalled();
    expect(quotesService.marcarEnValidacion).toHaveBeenCalledWith(QUOTE, CLIENTE);
    expect(guardadas[0]).toMatchObject({
      status: PaymentStatus.PENDING, amountInCents: 15_000_000, proofUrl: 'https://x/comprobantes/a.webp',
      quoteStatusBefore: QuoteStatus.ACCEPTED, paymentMethodType: 'MANUAL',
    });
    expect(guardadas[0].signature).toBeUndefined(); // Ya no se guarda la foto en base64 en la fila
  });

  it('sin foto, o con una foto inválida, no toca el pedido', async () => {
    const a = armar();
    await expect(a.service.processManualPayment(QUOTE, '', '', CLIENTE)).rejects.toBeInstanceOf(BadRequestException);
    const b = armar({ fotoFalla: true });
    await expect(b.service.processManualPayment(QUOTE, '', 'xx', CLIENTE)).rejects.toBeInstanceOf(BadRequestException);
    expect(a.quotesService.marcarEnValidacion).not.toHaveBeenCalled();
    expect(b.quotesService.marcarEnValidacion).not.toHaveBeenCalled();
  });

  it('al aprobarlo el administrador, el pedido queda pagado', async () => {
    const { service, quotesService } = armar({ tx: { id: 't', status: PaymentStatus.PENDING, quoteId: QUOTE } });
    await expect(service.revisarPagoManual('t', true, 'admin')).resolves.toEqual({ status: PaymentStatus.APPROVED });
    expect(quotesService.payQuote).toHaveBeenCalledWith(QUOTE, 'SYSTEM_ADMIN');
  });

  it('al rechazarlo, el pedido vuelve al estado que tenía y no se paga', async () => {
    const { service, quotesService } = armar({ tx: { id: 't', status: PaymentStatus.PENDING, quoteId: QUOTE, quoteStatusBefore: 'PENDING' } });
    await expect(service.revisarPagoManual('t', false, 'admin')).resolves.toEqual({ status: PaymentStatus.DECLINED });
    expect(quotesService.payQuote).not.toHaveBeenCalled();
    expect(quotesService.quitarValidacion).toHaveBeenCalledWith(QUOTE, 'PENDING');
    expect(quotesService.avisarComprobanteRechazado).toHaveBeenCalledWith(QUOTE); // Se le avisa al cliente
  });

  it('un comprobante ya revisado (o que otro admin acaba de revisar) no se procesa dos veces', async () => {
    const yaRevisado = armar({ tx: { id: 't', status: PaymentStatus.APPROVED, quoteId: QUOTE } });
    await expect(yaRevisado.service.revisarPagoManual('t', true, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    const carrera = armar({ tx: { id: 't', status: PaymentStatus.PENDING, quoteId: QUOTE }, affected: 0 });
    await expect(carrera.service.revisarPagoManual('t', true, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(carrera.quotesService.payQuote).not.toHaveBeenCalled();
  });

  it('si no se pudo marcar pagado, el comprobante vuelve a la fila de revisión', async () => {
    const { service, updates } = armar({ tx: { id: 't', status: PaymentStatus.PENDING, quoteId: QUOTE }, payQuoteFalla: true });
    await expect(service.revisarPagoManual('t', true, 'admin')).rejects.toThrow('estado');
    expect(updates.at(-1).set.status).toBe(PaymentStatus.PENDING);
  });
});
