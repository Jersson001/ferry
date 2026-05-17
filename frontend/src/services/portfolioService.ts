/**
 * portfolioService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión del portafolio — 100% via REST API (NestJS/PostgreSQL).
 * No usa Firebase Storage ni Firestore.
 * Las imágenes se convierten a base64 y se envían al backend.
 */

import { PortfolioItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

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
 * Sube un archivo de imagen o video usando multipart/form-data.
 * El backend se encarga de almacenarlo, comprimirlo a WebP, y guardar el registro.
 */
export async function uploadPortfolioFile(file: File, description?: string): Promise<PortfolioItem> {
  const token = localStorage.getItem('access_token');
  const formData = new FormData();
  formData.append('file', file);
  if (description) {
    formData.append('description', description);
  }

  const response = await fetch(`${API_URL}/portfolio/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    throw new Error('Sesión expirada');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error al subir el archivo');
  return data;
}

/**
 * Agrega un enlace al portafolio.
 */
export async function addPortfolioLink(url: string, description?: string): Promise<PortfolioItem> {
  return apiRequest<PortfolioItem>('/portfolio/items/link', {
    method: 'POST',
    body: JSON.stringify({ url, description }),
  });
}

/**
 * Elimina un ítem del portafolio.
 */
export async function removePortfolioItem(item: PortfolioItem): Promise<void> {
  await apiRequest(`/portfolio/items/${item.id}`, {
    method: 'DELETE',
  });
}
