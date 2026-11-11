import { datosDeTokenGoogle } from './google';

const CLIENTE = '976355293688-abc.apps.googleusercontent.com';
const ahora = new Date('2026-11-20T12:00:00Z');
const base = () => ({
  aud: CLIENTE,
  iss: 'https://accounts.google.com',
  exp: String(Math.floor(ahora.getTime() / 1000) + 3600),
  email: ' Ana@Correo.com ',
  email_verified: 'true',
  sub: '1234567890',
  name: 'Ana Pérez',
  picture: 'https://lh3.googleusercontent.com/a/x',
});

describe('datosDeTokenGoogle', () => {
  it('acepta un token válido y normaliza el correo', () => {
    expect(datosDeTokenGoogle(base(), CLIENTE, ahora)).toEqual({
      sub: '1234567890', email: 'ana@correo.com', name: 'Ana Pérez', picture: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('rechaza un token emitido para otra aplicación', () => {
    expect(datosDeTokenGoogle({ ...base(), aud: 'otra.apps.googleusercontent.com' }, CLIENTE, ahora)).toBeNull();
  });

  it('rechaza emisores que no son Google y tokens vencidos', () => {
    expect(datosDeTokenGoogle({ ...base(), iss: 'https://evil.example' }, CLIENTE, ahora)).toBeNull();
    expect(datosDeTokenGoogle({ ...base(), exp: String(Math.floor(ahora.getTime() / 1000) - 5) }, CLIENTE, ahora)).toBeNull();
  });

  it('rechaza correos sin verificar o sin identificador', () => {
    expect(datosDeTokenGoogle({ ...base(), email_verified: 'false' }, CLIENTE, ahora)).toBeNull();
    expect(datosDeTokenGoogle({ ...base(), email_verified: undefined }, CLIENTE, ahora)).toBeNull();
    expect(datosDeTokenGoogle({ ...base(), sub: '' }, CLIENTE, ahora)).toBeNull();
  });

  it('ignora fotos que no sean https y tolera basura', () => {
    expect(datosDeTokenGoogle({ ...base(), picture: 'http://x/y.png' }, CLIENTE, ahora)?.picture).toBeNull();
    expect(datosDeTokenGoogle(null, CLIENTE, ahora)).toBeNull();
    expect(datosDeTokenGoogle('texto', CLIENTE, ahora)).toBeNull();
  });
});
