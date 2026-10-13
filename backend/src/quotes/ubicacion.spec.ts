import { leerUbicacion, leerRadioKm, distanciaKm, estaEnRadio } from './ubicacion';

describe('leerUbicacion', () => {
  it('lee el formato que manda el frontend', () => {
    expect(leerUbicacion({ userLocation: { lat: 4.65, lng: -74.05 } })).toEqual({ lat: 4.65, lng: -74.05 });
  });
  it('también acepta userLat y userLng', () => {
    expect(leerUbicacion({ userLat: '4.65', userLng: '-74.05' })).toEqual({ lat: 4.65, lng: -74.05 });
  });
  it.each([null, {}, { userLocation: { lat: 'a', lng: 1 } }, { userLocation: { lat: 91, lng: 0 } }, { userLocation: { lat: 0, lng: 181 } }, { userLat: 1 }])(
    'descarta lo que no es una coordenada válida (%j)',
    (v) => expect(leerUbicacion(v)).toBeNull(),
  );
});

describe('leerRadioKm', () => {
  it.each([[undefined, 10], [0, 10], [-3, 10], ['x', 10], [25, 25], ['15', 15], [500, 50], [7.6, 8]])('%p → %p', (v, esperado) => {
    expect(leerRadioKm(v)).toBe(esperado);
  });
});

describe('distancia y radio', () => {
  const bogota = { lat: 4.711, lng: -74.0721 };
  const chia = { lat: 4.8587, lng: -74.0326 }; // ~16 km al norte
  it('mide km razonables', () => {
    const d = distanciaKm(bogota, chia);
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(18);
  });
  it('dentro y fuera del radio', () => {
    expect(estaEnRadio(chia, bogota, 20)).toBe(true);
    expect(estaEnRadio(chia, bogota, 10)).toBe(false);
  });
  it('sin ubicación de alguno no se excluye', () => {
    expect(estaEnRadio(null, bogota, 5)).toBe(true);
    expect(estaEnRadio(chia, null, 5)).toBe(true);
  });
});
