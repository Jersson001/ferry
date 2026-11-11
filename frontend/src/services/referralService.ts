const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

const CLAVE = 'ferry_ref';
const FORMATO = /^[A-Z0-9]{3,20}$/;

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || 'No se pudo completar la acción');
  return body as T;
};

const guardar = (valor: string | null) => {
  try {
    if (valor) localStorage.setItem(CLAVE, valor);
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento: el código simplemente no se recuerda */ }
};

// Al llegar con `?ref=CODIGO` se recuerda el código y se limpia la dirección.
// Se reclama más tarde, cuando la persona termina de registrarse.
export function recordarCodigoDeLlegada(): void {
  try {
    const url = new URL(window.location.href);
    const crudo = url.searchParams.get('ref');
    if (crudo === null) return;
    const codigo = crudo.trim().toUpperCase();
    if (FORMATO.test(codigo)) guardar(codigo);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* dirección no interpretable: se ignora */ }
}

// Con sesión iniciada, intenta atribuir la cuenta al código recordado. Siempre lo olvida después,
// salvo que la red falle: así se reintenta en la próxima visita dentro del plazo de 7 días.
export async function reclamarCodigoPendiente(): Promise<void> {
  let codigo: string | null = null;
  try { codigo = localStorage.getItem(CLAVE); } catch { /* ignorar */ }
  if (!codigo) return;
  try {
    await request('/referrals/claim', { method: 'POST', body: JSON.stringify({ code: codigo }) });
    guardar(null);
  } catch (e: any) {
    // Sesión vencida o red caída: se conserva. Cualquier otro rechazo del servidor es definitivo.
    if (e instanceof TypeError || /sesi/i.test(e?.message ?? '')) return;
    guardar(null);
  }
}

export interface CodigoReferido {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  total: number;
  tiendas: number;
  clientes: number;
}

export const enlaceDeReferido = (code: string) => `${window.location.origin}/?ref=${code}`;

export const listarCodigos = () => request<CodigoReferido[]>('/referrals/codes');

export const crearCodigo = (name: string, code?: string) =>
  request<CodigoReferido>('/referrals/codes', { method: 'POST', body: JSON.stringify({ name, code: code || undefined }) });

export const activarCodigo = (code: string, active: boolean) =>
  request<{ code: string; active: boolean }>(`/referrals/codes/${encodeURIComponent(code)}/active`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
