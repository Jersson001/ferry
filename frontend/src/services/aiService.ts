import { MaterialItem } from '../types';

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
  if (!response.ok) {
    const error = new Error(data.message || 'Error en la petición de IA') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
};

export const smartMatchWithAi = async (requestedItems: MaterialItem[]): Promise<any> => {
  return apiRequest<{ matches: any[] }>('/ai/smart-match', {
    method: 'POST',
    body: JSON.stringify({ requestedItems }),
  });
};
