export type NivelCliente = 'nuevo' | 'activo' | 'frecuente';

export interface HistorialCliente {
  solicitudes: number;
  entregados: number;
  nivel: NivelCliente;
}

// «Frecuente» se gana comprando de verdad (3 pedidos entregados), no solo pidiendo cotizaciones:
// pedir es gratis y se puede repetir sin comprar nada.
export function nivelDeCliente(solicitudes: number, entregados: number): NivelCliente {
  if (entregados >= 3) return 'frecuente';
  if (entregados >= 1 || solicitudes >= 3) return 'activo';
  return 'nuevo';
}

export function armarHistorial(solicitudes: unknown, entregados: unknown): HistorialCliente {
  const s = Math.max(0, Math.trunc(Number(solicitudes))) || 0;
  const e = Math.max(0, Math.trunc(Number(entregados))) || 0;
  return { solicitudes: s, entregados: e, nivel: nivelDeCliente(s, e) };
}
