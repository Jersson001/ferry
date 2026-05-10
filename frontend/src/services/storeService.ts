/**
 * storeService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión del perfil de tienda — 100% via REST API (NestJS).
 * No usa Firebase. El token JWT se lee de localStorage.
 */

import { UserProfile } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

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

export interface StoreProfileData {
  displayName: string;
  description: string;
  specialties: string[];
  rut?: string;
  photoURL?: string;
  location?: { lat: number; lng: number; address?: string };
}

/**
 * Guarda (o actualiza) el perfil público de la tienda.
 * Llama a PUT /stores/profile en el backend.
 */
export const saveStoreProfile = async (data: StoreProfileData): Promise<void> => {
  await apiRequest('/stores/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Construye un StoreProfileData desde un UserProfile.
 */
export const profileToStoreData = (profile: UserProfile): StoreProfileData => ({
  displayName: profile.displayName || '',
  description: profile.description || '',
  specialties: profile.specialties || [],
  rut: profile.rut,
  photoURL: profile.photoURL,
  location: profile.location,
});
