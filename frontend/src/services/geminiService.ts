import { MaterialItem } from "../types";

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
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error en la petición de IA');
  return data;
};

export const analyzeMaterialImage = async (base64Image: string): Promise<MaterialItem[]> => {
  try {
    const result = await apiRequest<{ items: MaterialItem[] }>('/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ base64Image }),
    });
    return result.items || [];
  } catch (error) {
    console.error("Error analyzing material image from backend:", error);
    return [];
  }
};

export const extractMaterialsFromText = async (textInput: string): Promise<MaterialItem[]> => {
  try {
    const result = await apiRequest<{ items: MaterialItem[] }>('/ai/parse-materials', {
      method: 'POST',
      body: JSON.stringify({ text: textInput }),
    });
    return result.items || [];
  } catch (error) {
    console.error("Error extracting materials from text via backend:", error);
    return [];
  }
};
