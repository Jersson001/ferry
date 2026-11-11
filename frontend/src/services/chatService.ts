// Chat entre el cliente y la ferretería de una cotización aceptada. Ver backend/src/quotes/chat.
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

const headers = () => {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export interface MensajeChat {
  id: string;
  from: 'me' | 'other';
  text: string | null;
  attachment: { url: string; type: 'image' | 'pdf'; name: string | null; size: number | null } | null;
  read: boolean;
  createdAt: string;
}

export interface Conversacion {
  rol: 'client' | 'store';
  aCiegas: boolean; // El cliente aún no pagó: no sabe qué ferretería es
  status: string;
  messages: MensajeChat[];
}

// Lo único que se puede adjuntar: imágenes y PDF.
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_IMAGEN = 15 * 1024 * 1024;
export const MAX_PDF = 10 * 1024 * 1024;

const leer = async <T>(res: Response, falla: string): Promise<T> => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || falla);
  return data as T;
};

export const getConversacion = async (quoteId: string): Promise<Conversacion> =>
  leer(await fetch(`${API_URL}/quotes/${quoteId}/messages`, { headers: headers() }), 'No se pudo cargar el chat');

export const enviarMensaje = async (
  quoteId: string,
  data: { text?: string; attachment?: { dataUrl: string; name: string } },
): Promise<MensajeChat> =>
  leer(await fetch(`${API_URL}/quotes/${quoteId}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }), 'No se pudo enviar el mensaje');

export const getNoLeidos = async (): Promise<Record<string, number>> => {
  try {
    const res = await fetch(`${API_URL}/quotes/chat/unread`, { headers: headers() });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
};

// Estados en los que la cotización tiene chat (los del frontend, en minúscula).
export const ESTADOS_CON_CHAT = ['accepted', 'pending_validation', 'paid', 'processing', 'preparing', 'shipped', 'delivered'];
