/**
 * portfolioService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión del portafolio — 100% via REST API (NestJS/PostgreSQL).
 * No usa Firebase Storage ni Firestore.
 * Las imágenes se convierten a base64 y se envían al backend.
 */

import { PortfolioItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;  // 30 MB

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    throw new Error('Sesión expirada');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error en la petición');
  return data;
};

export function validatePortfolioFile(file: File, type: 'image' | 'video'): string | null {
  if (type === 'image' && file.size > MAX_IMAGE_BYTES) return 'La imagen no puede superar 5 MB.';
  if (type === 'video' && file.size > MAX_VIDEO_BYTES) return 'El video no puede superar 30 MB.';
  return null;
}

/**
 * Convierte el archivo a base64 y lo sube al backend.
 * El backend se encarga de almacenarlo (disco local, S3, etc.).
 */
export async function uploadPortfolioFile(file: File, type: 'image' | 'video'): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const result = await apiRequest<{ url: string }>('/portfolio/upload', {
    method: 'POST',
    body: JSON.stringify({ base64, type, filename: file.name }),
  });
  return result.url;
}

/**
 * Agrega un ítem al portafolio del usuario autenticado.
 */
export async function addPortfolioItem(item: PortfolioItem): Promise<void> {
  await apiRequest('/portfolio/items', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

/**
 * Elimina un ítem del portafolio.
 */
export async function removePortfolioItem(item: PortfolioItem): Promise<void> {
  await apiRequest('/portfolio/items', {
    method: 'DELETE',
    body: JSON.stringify({ id: item.id }),
  });
}
