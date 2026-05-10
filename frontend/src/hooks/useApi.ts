import { useState, useCallback } from 'react';
import { UserProfile, UserRole, MaterialRequest, Quote, Product, MaterialItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// --- INTERFACES EXTENDIDAS ---
export interface CatalogProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  image?: string;
  isOnOffer?: boolean;
  discountPercent?: number;
  family?: string;
}

export interface CatalogProductStored extends CatalogProduct {
  id: string;
  storeId: string;
}

export interface StoreCatalogEntry {
    sku: string;
    price: number;
    lastUpdated?: any;
}

export interface IncomingQuoteRequest extends MaterialRequest {
    distanceKm?: number;
    deliveryAddress?: string;
    createdAt?: any;
    displayId?: string;
}

export interface StoreSentQuote {
    id: string;
    requestId: string;
    status: string;
    total: number;
    storeTotal?: number;
    createdAt: any;
    storeName: string;
    items?: any[];
    storeItems?: any[];
    transportCost?: number;
    message?: string;
}

export interface QuoteResponseItem {
  name: string;
  quantity: number;
  unit: string;
  available: boolean;
  price?: number;
  notes?: string;
  nombreComercial?: string;
  subtotal?: number;
  unitPrice?: number;
}

export interface ReceivedQuote extends Quote {
  requestId: string;
  requestTitle?: string;
  requestCategory?: string;
  requestDisplayId?: string;
  status: string;
  items: QuoteResponseItem[];
  total: number;
  createdAt: any;
  message?: string;
  distanceKm?: number;
  transportCost?: number;
  storeName: string; // Required to match Quote
  review?: {
    rating: number;
    comment?: string;
    createdAt: any;
  };
}

export interface UserOwnRequest extends MaterialRequest {
  displayId?: string;
  itemCount?: number;
  isExpandedSearch?: boolean;
  createdAt: any;
}

export interface AcceptQuoteResult {
  success: boolean;
  orderId?: string;
  splitCreated?: boolean;
}

export const formatRelativeTime = (dateInput: any): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays === 1) return 'ayer';
  return `hace ${diffDays} d`;
};

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

      const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
      
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('login')) {
            window.location.reload();
        }
        throw new Error('Sesión expirada');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error en la petición');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // --- AUTH METHODS ---
  const signInWithEmail = async (email: string, password: string) => {
    const data = await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const registerWithEmail = async (email: string, password: string, role: string, displayName: string) => {
    const data = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, displayName }),
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const verifyEmail = async (code: string) => {
    return request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  };

  const verifySession = async (): Promise<UserProfile | null> => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    try {
      const user = await request<any>('/auth/me');
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch {
      return null;
    }
  };

  const logoutUser = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  };

  const getCurrentUser = (): UserProfile | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  // --- PROFILE METHODS ---
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    const user = await request<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  };

  const saveStoreProfile = async (updates: any) => {
    return request('/stores/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  };

  // --- CATALOG METHODS ---
  const upsertProducts = async (storeId: string, products: CatalogProduct[]) => {
    return request(`/stores/${storeId}/catalog`, {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  };

  const getStoreCatalogProducts = async (storeId: string) => {
    return request<CatalogProductStored[]>(`/stores/${storeId}/catalog`);
  };

  const deleteCatalogProduct = async (storeId: string, sku: string) => {
    return request(`/stores/${storeId}/catalog/${sku}`, {
      method: 'DELETE',
    });
  };

  const getStorePriceCatalog = async () => {
      return request<Record<string, StoreCatalogEntry>>('/stores/catalog/prices');
  };

  const saveStorePriceCatalog = async (catalog: Record<string, StoreCatalogEntry>) => {
      return request('/stores/catalog/prices', {
          method: 'POST',
          body: JSON.stringify({ catalog })
      });
  };

  // --- QUOTE METHODS ---
  const getUserReceivedQuotes = async () => {
    return request<ReceivedQuote[]>('/quotes/responses/received');
  };

  const getUserOwnRequests = async () => {
    return request<UserOwnRequest[]>('/quotes/requests/own');
  };

  const sendQuoteRequest = async (data: any) => {
      return request('/quotes/requests', {
          method: 'POST',
          body: JSON.stringify(data)
      });
  };

  const acceptQuote = async (id: string, requestId?: string, title?: string) => {
    return request<AcceptQuoteResult>(`/quotes/${id}/accept`, { 
        method: 'POST',
        body: JSON.stringify({ requestId, title })
    });
  }

  const rejectQuote = async (id: string, requestId?: string, reason?: string) => {
    return request(`/quotes/${id}/reject`, { 
        method: 'POST',
        body: JSON.stringify({ requestId, reason })
    });
  };

  const markQuoteAsPaid = async (id: string, requestId?: string) => {
    return request(`/quotes/${id}/pay`, { 
        method: 'POST',
        body: JSON.stringify({ requestId })
    });
  };

  const acceptPartialQuote = async (id: string, requestId: string, splitRemaining: boolean) => {
    return request<AcceptQuoteResult>(`/quotes/${id}/accept`, { 
      method: 'POST', 
      body: JSON.stringify({ requestId, partial: true, splitRemaining }) 
    });
  };

  const submitManualPayment = async (data: { quoteId: string, reference: string, proofBase64?: string }) => {
    return request('/payments/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const subscribeToNewQuotes = (callback: (quoteId: string, data?: any, title?: string) => void) => {
    console.log('Suscripción a nuevas cotizaciones activa');
    return () => console.log('Suscripción cerrada');
  };

  const confirmDelivery = async (quoteId: string, requestId: string, review: { rating: number, comment: string }) => {
    return request(`/quotes/${quoteId}/status`, { 
      method: 'POST', 
      body: JSON.stringify({ requestId, ...review, status: 'DELIVERED' }) 
    });
  };

  const getPendingRequestsForStore = async () => {
    return request<IncomingQuoteRequest[]>('/quotes/requests/pending');
  };

  const submitQuoteResponse = async (data: any) => {
    return request('/quotes/responses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  const getStoreSentQuotes = async () => {
    return request<StoreSentQuote[]>('/quotes/responses/sent');
  };

  const rejectQuoteRequest = async (requestId: string) => {
    return request(`/quotes/requests/${requestId}/reject`, { method: 'POST' });
  };

  const updateQuoteLogisticStatus = async (quoteId: string, status: string) => {
      return request(`/quotes/${quoteId}/logistic-status`, {
          method: 'POST',
          body: JSON.stringify({ status })
      });
  };

  // --- AI METHODS ---
  const analyzeMaterialImage = async (base64: string) => {
      return request<any>('/ai/analyze-image', {
          method: 'POST',
          body: JSON.stringify({ image: base64 })
      });
  };

  const extractMaterialsFromText = async (text: string) => {
      return request<any>('/ai/extract-text', {
          method: 'POST',
          body: JSON.stringify({ text })
      });
  };

  // --- UTILS ---
  const normalizeRow = (row: any): CatalogProduct => ({
    sku: String(row.sku || row.SKU || ''),
    name: String(row.name || row.Nombre || row.nombre || ''),
    price: Number(row.price || row.Precio || row.precio || 0),
    stock: Number(row.stock || row.Stock || row.cantidad || 0),
    category: String(row.category || row.Categoría || 'General'),
    description: String(row.description || row.Descripción || ''),
    image: String(row.image || row.Imagen || ''),
    family: String(row.family || row.Familia || ''),
  });

  const fetchGoogleSheetCsv = async (url: string): Promise<string> => {
    const gSheetMatch = url.match(/\/d\/([^/]+)/);
    const csvUrl = gSheetMatch 
      ? `https://docs.google.com/spreadsheets/d/${gSheetMatch[1]}/export?format=csv`
      : url;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('No se pudo obtener el archivo de Google Sheets');
    return res.text();
  };

  const downloadCsvTemplate = () => {
    const headers = 'sku,name,price,stock,category,description,image,family\n';
    const sample = 'SKU001,Martillo Carpintero,25000,10,Herramientas,Martillo de alta calidad,,Herrajes\n';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_catalogo_ferry.csv';
    a.click();
  };

  const formatImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const id = url.match(/id=([^&]+)/)?.[1] || url.match(/\/d\/([^/]+)/)?.[1];
      return id ? `https://lh3.googleusercontent.com/u/0/d/${id}` : url;
    }
    return url;
  };

  const profileToStoreData = (profile: UserProfile | null) => {
      if (!profile) return {};
      return {
          displayName: profile.displayName,
          location: profile.location,
          specialties: profile.specialties,
          description: profile.description,
          photoURL: profile.photoURL
      };
  };

  return {
    loading,
    error,
    signInWithEmail,
    registerWithEmail,
    verifyEmail,
    verifySession,
    logoutUser,
    getCurrentUser,
    updateUserProfile,
    saveStoreProfile,
    upsertProducts,
    getStoreCatalogProducts,
    deleteCatalogProduct,
    getStorePriceCatalog,
    saveStorePriceCatalog,
    getUserReceivedQuotes,
    getUserOwnRequests,
    sendQuoteRequest,
    acceptQuote,
    rejectQuote,
    markQuoteAsPaid,
    acceptPartialQuote,
    submitManualPayment,
    subscribeToNewQuotes,
    confirmDelivery,
    getPendingRequestsForStore,
    submitQuoteResponse,
    getStoreSentQuotes,
    rejectQuoteRequest,
    updateQuoteLogisticStatus,
    analyzeMaterialImage,
    extractMaterialsFromText,
    normalizeRow,
    formatRelativeTime,
    fetchGoogleSheetCsv,
    downloadCsvTemplate,
    formatImageUrl,
    profileToStoreData,
  };
};
