import { contarTiendasQueCubren } from './cobertura';

const obra = { lat: 4.711, lng: -74.0721 };
const tiendas = [
  { specialties: ['Plomería'], location: { lat: 4.72, lng: -74.07 } },            // ~1 km
  { specialties: ['Plomería'], location: { lat: 4.8587, lng: -74.0326 } },        // ~16 km
  { specialties: ['Plomería', 'Gas'], location: { address: 'sin coordenadas' } },
  { specialties: ['Pintura'], location: { lat: 4.72, lng: -74.07 } },
  { specialties: [], location: { lat: 4.72, lng: -74.07 } },
];

describe('contarTiendasQueCubren', () => {
  it('cuenta por categoría y radio, e incluye las que no tienen coordenadas', () => {
    expect(contarTiendasQueCubren(tiendas, 'Plomería', obra, 5)).toBe(2);
    expect(contarTiendasQueCubren(tiendas, 'Plomería', obra, 20)).toBe(3);
  });
  it('otra categoría, otra cuenta', () => {
    expect(contarTiendasQueCubren(tiendas, 'Pintura', obra, 5)).toBe(1);
    expect(contarTiendasQueCubren(tiendas, 'Gas', obra, 5)).toBe(1);
  });
  it('sin ubicación de la obra cuentan todas las de la categoría', () => {
    expect(contarTiendasQueCubren(tiendas, 'Plomería', null, 5)).toBe(3);
  });
});
