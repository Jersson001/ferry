import { UsersController } from './users.controller';

describe('UsersController.updateProfile — campos permitidos', () => {
  const guardar = async (body: Record<string, unknown>) => {
    const update = jest.fn(async (_uid: string, cambios: unknown) => cambios);
    const controller = new UsersController({ update } as any);
    await controller.updateProfile({ user: { uid: 'usuario-1' } }, body);
    return update.mock.calls[0][1] as Record<string, unknown>;
  };

  it.each([
    ['role', 'ADMIN'],
    ['email', 'otro@correo.com'],
    ['password', 'texto-plano'],
    ['uid', 'otro-usuario'],
    ['isEmailVerified', true],
    ['emailVerificationToken', 'token'],
    ['resetPasswordToken', 'token'],
    ['resetPasswordExpiry', new Date()],
    ['priceMemory', { cemento: 1 }],
    ['portfolio', [{ url: 'x' }]],
    ['createdAt', new Date()],
  ])('ignora %s: un usuario no puede escribirlo desde su perfil', async (campo, valor) => {
    const cambios = await guardar({ displayName: 'Ana', [campo]: valor });
    expect(cambios).not.toHaveProperty(campo);
    expect(cambios.displayName).toBe('Ana');
  });

  it('deja pasar los datos propios del perfil', async () => {
    const cambios = await guardar({
      displayName: 'Ferretería Norte',
      description: 'Vendemos de todo',
      location: { lat: 4.6, lng: -74.1, address: 'Cra. 15 # 93-47' },
      photoURL: 'https://ejemplo.com/foto.jpg',
      phoneNumber: '3001234567',
      rut: '900123',
      specialties: ['Plomería'],
    });
    expect(cambios).toMatchObject({
      displayName: 'Ferretería Norte',
      description: 'Vendemos de todo',
      location: { lat: 4.6, lng: -74.1, address: 'Cra. 15 # 93-47' },
      photoURL: 'https://ejemplo.com/foto.jpg',
      phoneNumber: '3001234567',
      rut: '900123',
      specialties: ['Plomería'],
    });
  });

  it('descarta especialidades que no existen y las repetidas', async () => {
    const cambios = await guardar({ specialties: ['Plomería', 'Hackeo', 'Plomería', 'Gas', 42] });
    expect(cambios.specialties).toEqual(['Plomería', 'Gas']);
  });

  it('descarta una ubicación sin dirección y con coordenadas que no son números', async () => {
    const cambios = await guardar({ displayName: 'Ana', location: { lat: 'x', lng: -74 } });
    expect(cambios).not.toHaveProperty('location');
  });

  it('guarda la dirección aunque todavía no haya coordenadas: así llega una ferretería recién registrada', async () => {
    const cambios = await guardar({ location: { address: 'Cra. 15 # 93-47, Bogotá' } });
    expect(cambios.location).toEqual({ address: 'Cra. 15 # 93-47, Bogotá' });
  });

  it('guarda solo la dirección cuando las coordenadas son inválidas', async () => {
    const cambios = await guardar({ location: { lat: 'x', lng: 5, address: 'Calle 1' } });
    expect(cambios.location).toEqual({ address: 'Calle 1' });
  });

  it('descarta valores del tipo equivocado', async () => {
    const cambios = await guardar({ displayName: { $ne: null }, description: 123, specialties: 'Plomería' });
    expect(cambios).not.toHaveProperty('displayName');
    expect(cambios).not.toHaveProperty('description');
    expect(cambios).not.toHaveProperty('specialties');
  });

  it('traduce profileComplete a isProfileComplete', async () => {
    expect(await guardar({ profileComplete: true })).toMatchObject({ isProfileComplete: true });
  });
});
