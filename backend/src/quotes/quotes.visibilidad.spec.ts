import { QuotesService } from './quotes.service';
import { QuoteStatus } from './entities/quote.entity';

const encadenable = () => {
  const qb: any = {};
  for (const metodo of ['where', 'andWhere', 'orderBy', 'leftJoinAndSelect']) qb[metodo] = jest.fn(() => qb);
  qb.getMany = jest.fn(async () => []);
  qb.getCount = jest.fn(async () => 0);
  return qb;
};

const armar = (opciones: { especialidades?: unknown; solicitud?: any } = {}) => {
  const qbSolicitudes = encadenable();
  const requestRepository: any = {
    createQueryBuilder: jest.fn(() => qbSolicitudes),
    findOne: jest.fn(async () => opciones.solicitud),
    find: jest.fn(async () => [{ id: 'r1' }]),
  };
  const qbCotizaciones = encadenable();
  const quoteRepository: any = {
    find: jest.fn(async () => []),
    createQueryBuilder: jest.fn(() => qbCotizaciones),
  };
  const dataSource: any = {
    getRepository: jest.fn(() => ({
      findOne: jest.fn(async () => ({ uid: 'tienda-1', specialties: opciones.especialidades })),
    })),
  };
  return { service: new QuotesService(requestRepository, quoteRepository, dataSource), qbSolicitudes, qbCotizaciones, requestRepository, quoteRepository };
};

describe('Solicitudes que ve cada ferretería', () => {
  it('no carga los datos de quien pidió: la ferretería no los necesita ni debe recibirlos', async () => {
    const { service, qbSolicitudes } = armar({ especialidades: ['Iluminación'] });
    await service.getPendingRequests('tienda-1');
    expect(qbSolicitudes.leftJoinAndSelect).not.toHaveBeenCalled();
  });
});

describe('Datos de otras cuentas en las respuestas', () => {
  const usuarioConSecretos = {
    uid: 'u1',
    email: 'persona@correo.com',
    displayName: 'Persona',
    phoneNumber: '3001234567',
    password: '$2b$10$hash-de-contraseña',
    emailVerificationToken: 'token-verificacion',
    resetPasswordToken: 'token-reseteo',
    resetPasswordExpiry: new Date(),
    priceMemory: { cemento: 28000 },
    role: 'STORE',
  };

  it('la ferretería no recibe el usuario de quien pidió en sus cotizaciones enviadas', async () => {
    const { service, quoteRepository } = armar();
    quoteRepository.find.mockResolvedValue([
      {
        id: 'q1',
        status: QuoteStatus.PENDING,
        items: [],
        store: usuarioConSecretos,
        request: { id: 'r1', title: 'Pedido', category: 'Gas', user: usuarioConSecretos },
      },
    ]);
    const [cotizacion] = await service.getSentQuotes('tienda-1');
    expect(JSON.stringify(cotizacion)).not.toMatch(/hash-de-contraseña|token-verificacion|token-reseteo|persona@correo\.com/);
    expect(cotizacion.request).not.toHaveProperty('user');
    expect(cotizacion).not.toHaveProperty('store');
  });

  it('el cliente que ya pagó recibe solo el contacto de la ferretería, no su contraseña ni sus precios', async () => {
    const { service, qbCotizaciones } = armar();
    qbCotizaciones.getMany.mockResolvedValue([
      { id: 'q1', status: QuoteStatus.PAID, items: [], store: usuarioConSecretos, clientFinalTotal: 100 },
    ]);
    const [cotizacion] = await service.getReceivedQuotes('cliente-1');
    const tienda = cotizacion.store as Record<string, unknown>;
    expect(tienda.phoneNumber).toBe('3001234567');
    expect(tienda.displayName).toBe('Persona');
    for (const secreto of ['password', 'emailVerificationToken', 'resetPasswordToken', 'resetPasswordExpiry', 'priceMemory']) {
      expect(tienda).not.toHaveProperty(secreto);
    }
  });
});
