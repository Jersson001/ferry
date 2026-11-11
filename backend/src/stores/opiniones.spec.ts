import { armarOpiniones, limpiarTexto, primerNombre, MAX_TEXTO_OPINION, FilaOpinion } from './opiniones';

const fila = (extra: Partial<FilaOpinion> = {}): FilaOpinion => ({
  id: 'q1',
  rating: 5,
  reviewComment: ' Muy buen servicio ',
  reviewReply: null,
  reviewedAt: '2026-11-01T10:00:00.000Z',
  reviewRepliedAt: null,
  authorName: 'María Fernanda Gómez',
  ...extra,
});

describe('primerNombre', () => {
  it('deja solo el primer nombre y nunca un correo', () => {
    expect(primerNombre('María Fernanda Gómez')).toBe('María');
    expect(primerNombre('ana@correo.com')).toBe('Cliente');
    expect(primerNombre(null)).toBe('Cliente');
  });
});

describe('limpiarTexto', () => {
  it('recorta, limita el largo y trata lo vacío como null', () => {
    expect(limpiarTexto('  hola  ')).toBe('hola');
    expect(limpiarTexto('   ')).toBeNull();
    expect(limpiarTexto(42)).toBeNull();
    expect(limpiarTexto('x'.repeat(500))).toHaveLength(MAX_TEXTO_OPINION);
  });
});

describe('armarOpiniones', () => {
  it('no expone el id de la cotización en lo público, sí para la tienda', () => {
    expect(armarOpiniones([fila()])[0]).not.toHaveProperty('id');
    expect(armarOpiniones([fila()], true)[0].id).toBe('q1');
  });

  it('descarta calificaciones fuera de 1 a 5 y conserva la respuesta de la tienda', () => {
    const r = armarOpiniones([
      fila({ id: 'a', rating: 0 }),
      fila({ id: 'b', rating: 6 }),
      fila({ id: 'c', reviewReply: 'Gracias', reviewRepliedAt: '2026-11-02T10:00:00.000Z' }),
    ], true);
    expect(r.map(o => o.id)).toEqual(['c']);
    expect(r[0].reply).toBe('Gracias');
    expect(r[0].comment).toBe('Muy buen servicio');
    expect(r[0].author).toBe('María');
  });
});
