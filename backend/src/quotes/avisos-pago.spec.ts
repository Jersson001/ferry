import { QuotesService } from './quotes.service';
import { QuoteStatus } from './entities/quote.entity';
import { avisosPedidoPagado, avisoComprobanteRechazado } from './avisos-pago';

describe('Textos de los avisos de pago', () => {
  const datos = {
    displayId: 'REQ-74462', title: 'Baño segundo piso', deliveryAddress: 'Calle 10 # 5-20',
    clientName: 'Ana', clientPhone: '3001234567', storeName: 'Ferretería Prueba', storeTotal: 25000,
  };

  it('a la tienda le dice que aliste el pedido, cuánto recibe y a quién entregar', () => {
    const { tienda } = avisosPedidoPagado(datos);
    expect(tienda.titulo).toBe('¡Pedido pagado! Alista el pedido #REQ-74462');
    const texto = tienda.parrafos.join('\n');
    expect(texto).toContain('$25.000');
    expect(texto).toContain('Ana · 3001234567');
    expect(texto).toContain('Calle 10 # 5-20');
  });

  it('al cliente le confirma el pago y quién está alistando', () => {
    const { cliente } = avisosPedidoPagado(datos);
    expect(cliente.titulo).toBe('Tu pago fue confirmado #REQ-74462');
    expect(cliente.cuerpo).toContain('Ferretería Prueba');
  });

  it('sin datos opcionales no deja líneas vacías ni "undefined"', () => {
    const { tienda, cliente } = avisosPedidoPagado({ storeTotal: 1000 });
    const todo = JSON.stringify({ tienda, cliente });
    expect(todo).not.toContain('undefined');
    expect(todo).not.toContain('null');
    expect(tienda.parrafos.some(p => p.startsWith('Cliente:'))).toBe(false);
  });

  it('el aviso de comprobante rechazado ofrece pagar de nuevo', () => {
    const a = avisoComprobanteRechazado({ displayId: 'REQ-1', title: 'x' });
    expect(a.titulo).toBe('No pudimos confirmar tu pago #REQ-1');
    expect(a.parrafos.join(' ')).toContain('Nequi');
  });
});

describe('QuotesService: quién recibe los avisos de pago', () => {
  const tienda = { uid: 'tienda-1', email: 'tienda@x.test', displayName: 'Ferretería Prueba' };
  const cliente = { uid: 'cliente-1', email: 'cliente@x.test', displayName: 'Ana', phoneNumber: '300' };
  const quote = {
    id: 'q1', storeBaseTotal: 20000, transportCost: 5000, store: tienda,
    request: { displayId: 'REQ-9', title: 'Pedido', deliveryAddress: 'Calle 1', user: cliente },
  };

  const armar = () => {
    const push = { avisarUsuario: jest.fn(async () => 1) };
    const mail = { sendAviso: jest.fn(async () => undefined) };
    const quoteRepository = { findOne: jest.fn(async () => quote) };
    const service = new QuotesService({} as any, quoteRepository as any, {} as any, push as any, mail as any);
    return { service, push, mail };
  };

  it('al pagarse avisa a la tienda y al cliente, por push y por correo', async () => {
    const { service, push, mail } = armar();
    await service.avisarPedidoPagado('q1');
    expect(push.avisarUsuario).toHaveBeenCalledWith('tienda-1', expect.objectContaining({ title: '¡Pedido pagado! Alista el pedido #REQ-9' }));
    expect(push.avisarUsuario).toHaveBeenCalledWith('cliente-1', expect.objectContaining({ title: 'Tu pago fue confirmado #REQ-9' }));
    expect(mail.sendAviso).toHaveBeenCalledWith('tienda@x.test', expect.objectContaining({ parrafos: expect.arrayContaining(['Vas a recibir $25.000 por los materiales y el envío.']) }));
    expect(mail.sendAviso).toHaveBeenCalledWith('cliente@x.test', expect.anything());
  });

  it('si el push o el correo fallan, no rompe nada', async () => {
    const { service, push, mail } = armar();
    push.avisarUsuario.mockRejectedValue(new Error('caído'));
    mail.sendAviso.mockRejectedValue(new Error('caído'));
    await expect(service.avisarPedidoPagado('q1')).resolves.toBeUndefined();
  });

  it('el comprobante rechazado solo se le avisa al cliente', async () => {
    const { service, push, mail } = armar();
    await service.avisarComprobanteRechazado('q1');
    expect(push.avisarUsuario).toHaveBeenCalledTimes(1);
    expect(push.avisarUsuario).toHaveBeenCalledWith('cliente-1', expect.anything());
    expect(mail.sendAviso).toHaveBeenCalledWith('cliente@x.test', expect.anything());
  });

  it('payQuote avisa una sola vez: al pagar, no al volver a confirmar un pedido ya pagado', async () => {
    const hacer = (estado: QuoteStatus) => {
      const q: any = { id: 'q1', requestId: 'r1', status: estado };
      const qb: any = { where: () => qb, setLock: () => qb, getOne: async () => q };
      const manager = {
        createQueryBuilder: () => qb,
        findOne: jest.fn(async () => ({ id: 'r1', userId: 'cliente-1' })),
        save: jest.fn(async (x) => x),
        update: jest.fn(async () => ({})),
      };
      const runner = { connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(), manager };
      const service = new QuotesService({} as any, {} as any, { createQueryRunner: () => runner } as any);
      const avisar = jest.spyOn(service, 'avisarPedidoPagado').mockResolvedValue();
      return { service, avisar };
    };
    const nuevo = hacer(QuoteStatus.ACCEPTED);
    await nuevo.service.payQuote('q1', 'cliente-1');
    expect(nuevo.avisar).toHaveBeenCalledTimes(1);

    const yaPagado = hacer(QuoteStatus.PAID);
    await yaPagado.service.payQuote('q1', 'cliente-1');
    expect(yaPagado.avisar).not.toHaveBeenCalled();
  });
});
