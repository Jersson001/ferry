import { ESPECIALIDADES } from '../users/perfil';

// Un pedido se envía a una o dos tiendas expertas (especialidades). La primera va en `category` y la segunda,
// si la hay, en `categoriaExtra`: así lo viejo que solo conoce `category` sigue funcionando.

export const MAX_TIENDAS_POR_PEDIDO = 2;

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Las tiendas expertas que pidió el cliente, en su orden, sin repetir y como máximo dos. Acepta
 * `categories` (lista) o el `category` de siempre. Solo pasan especialidades conocidas; si ninguna lo es,
 * se conserva el `category` que llegó (p. ej. "General"), como antes.
 */
export function tiendasDelPedido(data: { category?: unknown; categories?: unknown }): { category: string; categoriaExtra: string | null } {
  const pedidas = (Array.isArray(data.categories) ? data.categories : [data.category])
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '');
  const validas: string[] = [];
  for (const c of pedidas) {
    const esp = ESPECIALIDADES.find(e => sinTildes(e) === sinTildes(c));
    if (esp && !validas.includes(esp)) validas.push(esp);
  }
  if (validas.length === 0) {
    const original = typeof data.category === 'string' && data.category.trim() ? data.category.trim() : 'General';
    return { category: original, categoriaExtra: null };
  }
  return { category: validas[0], categoriaExtra: validas[1] ?? null };
}

/** Las especialidades de una solicitud: una o dos. */
export const categoriasDeLaSolicitud = (r: { category?: string | null; categoriaExtra?: string | null }): string[] =>
  [r.category, r.categoriaExtra].filter((c): c is string => !!c);
