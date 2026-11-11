import { armarCatalogoPublico, esIdValido, FilaCatalogoPublico } from './catalogo-publico';

const fila = (extra: Partial<FilaCatalogoPublico> = {}): FilaCatalogoPublico => ({
  id: 'p1',
  name: 'Cemento 50kg',
  price: 30000,
  stock: 10,
  category: 'Obra Civil',
  description: null,
  imageUrl: null,
  isOnOffer: false,
  discountPercent: 0,
  ...extra,
});

describe('armarCatalogoPublico', () => {
  it('no expone SKU, costo ni existencias', () => {
    const [p] = armarCatalogoPublico([{ ...fila(), sku: 'X1', cost: 5 } as any]);
    expect(Object.keys(p).sort()).toEqual(
      ['category', 'description', 'discountPercent', 'finalPrice', 'id', 'image', 'name', 'price'],
    );
  });

  it('aplica el descuento solo si el producto está en oferta', () => {
    const r = armarCatalogoPublico([
      fila({ id: 'a', isOnOffer: true, discountPercent: 20 }),
      fila({ id: 'b', isOnOffer: false, discountPercent: 20 }),
    ]);
    expect(r[0].finalPrice).toBe(24000);
    expect(r[1].finalPrice).toBe(30000);
    expect(r[1].discountPercent).toBe(0);
  });

  it('descarta agotados y precios no válidos', () => {
    const r = armarCatalogoPublico([fila({ id: 'a', stock: 0 }), fila({ id: 'b', price: 0 }), fila({ id: 'c' })]);
    expect(r.map(p => p.id)).toEqual(['c']);
  });
});

describe('esIdValido', () => {
  it('acepta UUID y rechaza lo demás', () => {
    expect(esIdValido('3f2b8a52-0d8e-4c7e-9a43-2b6f1c0d5e11')).toBe(true);
    expect(esIdValido('abc')).toBe(false);
    expect(esIdValido(undefined)).toBe(false);
  });
});
