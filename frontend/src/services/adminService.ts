const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || 'No se pudo completar la acción');
  return body as T;
};

export interface ResumenAdmin {
  usuarios: { total: number; tiendas: number; clientes: number; nuevos7d: number };
  solicitudes: { total: number; nuevas7d: number };
  pedidosEntregados: number;
  opiniones: { total: number; ocultas: number; promedio: number | null };
  referidos: number;
  catalogo: { visitas7d: number; porQr7d: number; masVistas: Array<{ storeId: string; name: string; visitas: number }> };
}

export interface OpinionAdmin {
  kind: 'tienda' | 'contratista';
  id: string;
  rating: number;
  comment: string;
  reply: string | null;
  hidden: boolean;
  date: string | null;
  store: string;
  client: string;
}

export const getResumenAdmin = () => request<ResumenAdmin>('/admin/summary');
export const getOpinionesAdmin = () => request<OpinionAdmin[]>('/admin/reviews');
export const ocultarOpinion = (o: Pick<OpinionAdmin, 'kind' | 'id'>, hidden: boolean) =>
  request<{ hidden: boolean }>(
    o.kind === 'contratista'
      ? `/projects/applications/${encodeURIComponent(o.id)}/review-hidden`
      : `/quotes/${encodeURIComponent(o.id)}/review-hidden`,
    {
      method: 'POST',
      body: JSON.stringify({ hidden }),
    },
  );
