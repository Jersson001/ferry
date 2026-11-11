export interface ResumenAdmin {
  usuarios: { total: number; tiendas: number; clientes: number; nuevos7d: number };
  solicitudes: { total: number; nuevas7d: number };
  pedidosEntregados: number;
  opiniones: { total: number; ocultas: number; promedio: number | null };
  referidos: number;
  catalogo: { visitas7d: number; porQr7d: number; masVistas: Array<{ storeId: string; name: string; visitas: number }> };
}

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const promedio = (suma: unknown, cantidad: unknown): number | null => {
  const c = num(cantidad);
  return c > 0 ? Math.round((num(suma) / c) * 10) / 10 : null;
};

export const haceDias = (dias: number, ahora: Date = new Date()): Date => new Date(ahora.getTime() - dias * 86400000);
