import { ordenarTiendasPorCalificacion, FilaCalificacion } from './top-stores';

const fila = (id: string, average: number | string, reviews: number | string, extra: Partial<FilaCalificacion> = {}): FilaCalificacion => ({
  id,
  name: `Tienda ${id}`,
  photoUrl: null,
  specialties: null,
  location: null,
  average,
  reviews,
  ...extra,
});

describe('ordenarTiendasPorCalificacion', () => {
  it('devuelve una lista vacía cuando nadie ha calificado', () => {
    expect(ordenarTiendasPorCalificacion([], 10)).toEqual([]);
  });

  it('una sola calificación de 5 no supera a una tienda con muchas calificaciones altas', () => {
    const resultado = ordenarTiendasPorCalificacion([fila('nueva', 5, 1), fila('constante', 4.8, 20)], 10);
    expect(resultado.map(t => t.id)).toEqual(['constante', 'nueva']);
  });

  it('con la misma calificación gana la que tiene más reseñas', () => {
    const resultado = ordenarTiendasPorCalificacion([fila('a', 4.5, 2), fila('b', 4.5, 10)], 10);
    expect(resultado.map(t => t.id)).toEqual(['b', 'a']);
  });

  it('muestra el promedio real redondeado a un decimal, no el ponderado', () => {
    const [tienda] = ordenarTiendasPorCalificacion([fila('a', '4.666666', '3')], 10);
    expect(tienda.rating).toBe(4.7);
    expect(tienda.reviews).toBe(3);
  });

  it('respeta el límite', () => {
    const filas = [fila('a', 5, 5), fila('b', 4, 5), fila('c', 3, 5)];
    expect(ordenarTiendasPorCalificacion(filas, 2)).toHaveLength(2);
  });

  it('convierte las especialidades guardadas como texto en una lista', () => {
    const [tienda] = ordenarTiendasPorCalificacion([fila('a', 4, 3, { specialties: 'Plomería, Gas' })], 10);
    expect(tienda.specialties).toEqual(['Plomería', 'Gas']);
  });

  it('descarta filas sin calificaciones o con datos inválidos', () => {
    const filas = [fila('a', 4, 0), fila('b', 'no-es-numero', 3), fila('c', 4, 3)];
    expect(ordenarTiendasPorCalificacion(filas, 10).map(t => t.id)).toEqual(['c']);
  });
});
