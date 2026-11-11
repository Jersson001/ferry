import { haceDias, num, promedio } from './admin-stats';

describe('admin-stats', () => {
  it('num convierte los textos que devuelve Postgres y cae en 0 si no es número', () => {
    expect(num('12')).toBe(12);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('promedio redondea a un decimal y es null sin opiniones', () => {
    expect(promedio('13', '3')).toBe(4.3);
    expect(promedio(0, 0)).toBeNull();
    expect(promedio(null, null)).toBeNull();
  });

  it('haceDias resta días completos', () => {
    const base = new Date('2026-11-20T12:00:00Z');
    expect(haceDias(7, base).toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });
});
