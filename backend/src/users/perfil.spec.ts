import { categoriasDeLaTienda, contactoPublico, perfilPropio } from './perfil';
import { StoresService } from '../stores/stores.service';

const SECRETOS = ['password', 'emailVerificationToken', 'resetPasswordToken', 'resetPasswordExpiry', 'priceMemory', 'portfolio'];

const usuarioCompleto = {
  uid: 'u1',
  email: 'a@b.com',
  displayName: 'Ana',
  role: 'STORE',
  phoneNumber: '300',
  isEmailVerified: true,
  isProfileComplete: true,
  location: { lat: 1, lng: 2, address: 'Calle 1' },
  description: 'Hola',
  specialties: ['Gas'],
  photoURL: 'https://x/y.jpg',
  rut: '9',
  families: ['a'],
  createdAt: new Date(),
  password: '$2b$hash',
  emailVerificationToken: 't1',
  resetPasswordToken: 't2',
  resetPasswordExpiry: new Date(),
  priceMemory: { cemento: 1 },
  portfolio: [{ url: 'x' }],
};

describe('categoriasDeLaTienda', () => {
  it('devuelve las categorías en su forma canónica', () => {
    expect(categoriasDeLaTienda(['iluminacion', 'GAS'])).toEqual(['Iluminación', 'Gas']);
  });

  it.each([[undefined], [null], ['Gas'], [42], [[]], [['Inventada', 7]]])('%p no habilita ninguna', valor => {
    expect(categoriasDeLaTienda(valor)).toEqual([]);
  });
});

describe('contactoPublico', () => {
  it('deja el contacto y quita contraseña, tokens y precios', () => {
    const publico = contactoPublico(usuarioCompleto) as Record<string, unknown>;
    expect(publico).toMatchObject({ uid: 'u1', displayName: 'Ana', phoneNumber: '300' });
    for (const secreto of SECRETOS) expect(publico).not.toHaveProperty(secreto);
    expect(publico).not.toHaveProperty('email');
  });

  it('sin usuario devuelve undefined', () => {
    expect(contactoPublico(null)).toBeUndefined();
  });
});

describe('perfilPropio', () => {
  it('conserva los datos del perfil y quita contraseña, tokens y precios', () => {
    const propio = perfilPropio(usuarioCompleto) as Record<string, unknown>;
    expect(propio).toMatchObject({ uid: 'u1', email: 'a@b.com', role: 'STORE', specialties: ['Gas'], isProfileComplete: true });
    for (const secreto of SECRETOS) expect(propio).not.toHaveProperty(secreto);
  });
});

describe('StoresService.getStoreRating', () => {
  const armar = (fila: unknown) => {
    const qb: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere']) qb[m] = jest.fn(() => qb);
    qb.getRawOne = jest.fn(async () => fila);
    const dataSource: any = { getRepository: jest.fn(() => ({ createQueryBuilder: jest.fn(() => qb) })) };
    return new StoresService({} as any, {} as any, dataSource, {} as any);
  };

  it('devuelve el promedio redondeado y la cantidad de calificaciones', async () => {
    expect(await armar({ average: '4.666666', reviews: '3' }).getStoreRating('t1')).toEqual({ rating: 4.7, reviews: 3 });
  });

  it('sin calificaciones devuelve null y no un 0 ni un número inventado', async () => {
    expect(await armar({ average: null, reviews: '0' }).getStoreRating('t1')).toEqual({ rating: null, reviews: 0 });
    expect(await armar(undefined).getStoreRating('t1')).toEqual({ rating: null, reviews: 0 });
  });
});

describe('StoresService.updateStoreProfile — RUT', () => {
  it('verifica el RUT nuevo y no conserva la verificación del anterior', async () => {
    const anterior = { uid: 't1', rut: '890903938-8', rutVerificacion: { estado: 'VERIFICADO' } };
    const usersService: any = { findOne: jest.fn(async () => anterior), update: jest.fn(async (_uid: string, c: any) => ({ ...anterior, ...c })) };
    const verificador: any = { verificar: jest.fn(async () => ({ estado: 'NO_REGISTRADO', nit: '900123456-8', mensaje: '', verificadoEn: '' })) };
    const service = new StoresService({} as any, usersService, {} as any, verificador);

    const perfil = await service.updateStoreProfile('t1', { rut: '900123456', rutVerificacion: { estado: 'VERIFICADO' } });

    expect(verificador.verificar).toHaveBeenCalledWith('900123456');
    expect(perfil.rut).toBe('900123456-8');
    expect(perfil.rutVerificacion.estado).toBe('NO_REGISTRADO');
  });
});
