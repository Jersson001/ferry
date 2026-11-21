import { tiendasDelPedido, categoriasDeLaSolicitud } from './tiendas-pedido';
import { contarTiendasQueCubren } from '../stores/cobertura';

describe('Hasta dos tiendas expertas por pedido', () => {
  it('con una sola, como siempre', () => {
    expect(tiendasDelPedido({ category: 'Plomería' })).toEqual({ category: 'Plomería', categoriaExtra: null });
  });

  it('con dos, la primera va en category y la segunda en categoriaExtra', () => {
    expect(tiendasDelPedido({ categories: ['Plomería', 'Eléctricos'] })).toEqual({ category: 'Plomería', categoriaExtra: 'Eléctricos' });
  });

  it('nunca más de dos, sin repetir, y tolera tildes y mayúsculas', () => {
    expect(tiendasDelPedido({ categories: ['plomeria', 'Plomería', 'ELECTRICOS', 'Gas'] }))
      .toEqual({ category: 'Plomería', categoriaExtra: 'Eléctricos' });
  });

  it('descarta lo que no es una especialidad', () => {
    expect(tiendasDelPedido({ categories: ['Inventada', 'Gas'] })).toEqual({ category: 'Gas', categoriaExtra: null });
  });

  it('si nada es válido conserva lo que llegó, como antes', () => {
    expect(tiendasDelPedido({ category: 'General' })).toEqual({ category: 'General', categoriaExtra: null });
    expect(tiendasDelPedido({})).toEqual({ category: 'General', categoriaExtra: null });
  });

  it('las especialidades de una solicitud son una o dos', () => {
    expect(categoriasDeLaSolicitud({ category: 'Gas', categoriaExtra: null })).toEqual(['Gas']);
    expect(categoriasDeLaSolicitud({ category: 'Gas', categoriaExtra: 'Plomería' })).toEqual(['Gas', 'Plomería']);
  });

  it('la cobertura cuenta las tiendas de cualquiera de las dos, sin contar doble', () => {
    const tiendas = [
      { specialties: ['Plomería'] },
      { specialties: ['Eléctricos'] },
      { specialties: ['Plomería', 'Eléctricos'] },
      { specialties: ['Gas'] },
    ];
    expect(contarTiendasQueCubren(tiendas, 'Plomería', null, 10)).toBe(2);
    expect(contarTiendasQueCubren(tiendas, 'Plomería,Eléctricos', null, 10)).toBe(3);
  });
});
