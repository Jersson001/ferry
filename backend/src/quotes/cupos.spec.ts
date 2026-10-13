import { inicioDelDiaColombia, itemsDeCotizacionValidos } from './cupos';

describe('inicioDelDiaColombia', () => {
  it('a las 23:00 en Colombia sigue siendo el mismo día (04:00 UTC del día siguiente)', () => {
    expect(inicioDelDiaColombia(new Date('2026-10-14T04:00:00Z')).toISOString()).toBe('2026-10-13T05:00:00.000Z');
  });

  it('pasada la medianoche local empieza un día nuevo (05:00 UTC)', () => {
    expect(inicioDelDiaColombia(new Date('2026-10-14T05:00:00Z')).toISOString()).toBe('2026-10-14T05:00:00.000Z');
  });

  it('a media mañana local devuelve la medianoche local de ese día', () => {
    expect(inicioDelDiaColombia(new Date('2026-10-13T15:30:00Z')).toISOString()).toBe('2026-10-13T05:00:00.000Z');
  });
});

describe('itemsDeCotizacionValidos', () => {
  const bueno = { storeBaseUnitPrice: 1000, quantity: 2 };

  it('acepta una cotización normal, con artículos sin stock en precio 0', () => {
    expect(itemsDeCotizacionValidos([bueno, { storeBaseUnitPrice: 0, quantity: 1, available: false }])).toBeNull();
  });

  it.each([
    ['sin artículos', []],
    ['no es lista', 'x'],
    ['precio negativo', [{ storeBaseUnitPrice: -5, quantity: 1 }]],
    ['precio en texto', [{ storeBaseUnitPrice: '100', quantity: 1 }]],
    ['precio infinito', [{ storeBaseUnitPrice: Infinity, quantity: 1 }]],
    ['cantidad cero', [{ storeBaseUnitPrice: 1, quantity: 0 }]],
    ['cantidad negativa', [{ storeBaseUnitPrice: 1, quantity: -2 }]],
    ['cantidad NaN', [{ storeBaseUnitPrice: 1, quantity: NaN }]],
    ['artículo nulo', [null]],
  ])('rechaza: %s', (_n, valor) => {
    expect(itemsDeCotizacionValidos(valor)).not.toBeNull();
  });
});
