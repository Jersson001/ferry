import { textoDeAviso, endpointValido } from './avisos';

describe('textoDeAviso', () => {
  it('incluye la categoría y la distancia, sin datos del cliente', () => {
    const t = textoDeAviso('Plomería', { lat: 4.8587, lng: -74.0326 }, { lat: 4.711, lng: -74.0721 });
    expect(t.body).toContain('Plomería');
    expect(t.body).toMatch(/a 1\d(\.\d)? km/);
  });
  it('sin ubicaciones no inventa la distancia', () => {
    expect(textoDeAviso('Gas', null, null).body).not.toContain('km de');
  });
});

describe('endpointValido', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('acepta %s', (e) => expect(endpointValido(e)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'https://evil.com/?fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'no es url',
    '',
    null,
    42,
  ])('rechaza %p', (e) => expect(endpointValido(e as any)).toBe(false));
});
