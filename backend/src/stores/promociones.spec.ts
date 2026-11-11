import { armarPromociones, FilaPromocion } from './promociones';

const fila = (extra: Partial<FilaPromocion> = {}): FilaPromocion => ({
  id: 'p1',
  name: 'Taladro 20V',
  price: 100000,
  discountPercent: 25,
  stock: 3,
  category: 'Herramientas',
  imageUrl: null,
  storeId: 's1',
  storeName: 'Ferretería Central',
  storePhoto: null,
  specialties: 'Herramientas, Eléctrico',
  location: null,
  ...extra,
});

describe('armarPromociones', () => {
  it('calcula el precio con descuento y separa las especialidades de la tienda', () => {
    const [p] = armarPromociones([fila()], 10);
    expect(p.finalPrice).toBe(75000);
    expect(p.specialties).toEqual(['Herramientas', 'Eléctrico']);
  });

  it('descarta descuentos inválidos, productos sin stock y precios no positivos', () => {
    const filas = [
      fila({ id: 'a', discountPercent: 0 }),
      fila({ id: 'b', discountPercent: 100 }),
      fila({ id: 'c', stock: 0 }),
      fila({ id: 'd', price: 0 }),
      fila({ id: 'e' }),
    ];
    expect(armarPromociones(filas, 10).map(p => p.id)).toEqual(['e']);
  });

  it('respeta el límite y tolera tiendas sin especialidad ni nombre', () => {
    const filas = [fila({ id: 'a', specialties: null, storeName: null }), fila({ id: 'b' }), fila({ id: 'c' })];
    const r = armarPromociones(filas, 2);
    expect(r).toHaveLength(2);
    expect(r[0].specialties).toEqual([]);
    expect(r[0].storeName).toBe('Ferretería');
  });
});
