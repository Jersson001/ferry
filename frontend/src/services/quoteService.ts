/**
 * quoteService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión de cotizaciones — 100% via REST API (NestJS/PostgreSQL).
 * No usa Firebase. El token JWT se lee de localStorage.
 */

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
  if (!response.ok) throw new Error(data.message || 'Error en la petición');
  return data;
};

// ─── Comisión de plataforma ───────────────────────────────────────────────────
export const FERRY_MARKUP = 0.14; // 14 % — tarifa plataforma

export const applyFerryMarkup = (
  storeItems: QuoteResponseItem[],
): QuoteResponseItem[] => {
  const factor = 1 + FERRY_MARKUP;
  return storeItems.map(item =>
    item.available
      ? {
          ...item,
          unitPrice: Math.round(item.unitPrice * factor),
          subtotal:  Math.round(item.subtotal  * factor),
        }
      : item,
  );
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface QuoteRequestPayload {
  category: string;
  items: MaterialItem[];
  userLocation?: { lat: number; lng: number } | null;
  title?: string;
  deliveryAddress: string;
}

export interface IncomingQuoteRequest {
  id: string;
  userId: string;
  category: string;
  items: MaterialItem[];
  status: string;
  createdAt: any;
  userLocation?: { lat: number; lng: number } | null;
  distanceKm?: number;
  title?: string;
  displayId?: string;
  deliveryAddress?: string;
}

export interface StoreCatalogEntry {
  price: number;
  sku: string | null;
}

export interface QuoteResponseItem {
  name: string;
  nombreComercial?: string | null;
  quantity: string;
  unit: string;
  unitPrice: number;
  subtotal: number;
  available: boolean;
  sku?: string | null;
}

export interface QuoteResponsePayload {
  requestId: string;
  storeName: string;
  storeItems: QuoteResponseItem[];
  storeSubtotalBruto: number;
  discount: number;
  storeSubtotalNeto: number;
  taxRate: number;
  taxAmount: number;
  transportCost: number;
  storeTotal: number;
  distanceKm?: number;
  message?: string;
}

export interface StoreSentQuote {
  id: string;
  requestId: string;
  storeName: string;
  items: QuoteResponseItem[];
  storeItems?: QuoteResponseItem[];
  total: number;
  storeTotal?: number;
  transportCost: number;
  message: string;
  status: string;
  createdAt: any;
  distanceKm?: number | null;
}

export interface QuoteReview {
  rating:    number;
  comment:   string;
  createdAt: any;
}

export interface ReceivedQuote {
  id: string;
  requestId: string;
  storeId: string;
  storeName: string;
  items: QuoteResponseItem[];
  total: number;
  transportCost?: number;
  message: string;
  status: string;
  review?: QuoteReview;
  createdAt: any;
  distanceKm?: number | null;
  requestCategory?: string;
  requestDisplayId?: string;
  requestTitle?: string;
}

export interface AcceptQuoteResult {
  splitCreated: boolean;
  splitRequestId?: string;
}

export interface UserOwnRequest {
  id: string;
  title: string;
  displayId: string;
  category: string;
  status: string;
  itemCount: number;
  createdAt: any;
  items: Array<{ name: string; quantity: number; unit: string }>;
  isExpandedSearch?: boolean;
  parentRequestId?: string;
}

export interface RecentPendingQuote {
  id: string;
  requestId: string;
  requestTitle?: string;
  requestDisplayId?: string;
  availableItems: number;
  totalItems: number;
  createdAt: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Quote Requests ───────────────────────────────────────────────────────────

export const sendQuoteRequest = async (payload: QuoteRequestPayload): Promise<string> => {
  const result = await apiRequest<{ id: string }>('/quotes/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.id;
};

export const getPendingRequestsForStore = async (
  _storeCategory?: string,
  _storeLocation?: { lat: number; lng: number } | null
): Promise<IncomingQuoteRequest[]> => {
  return apiRequest<IncomingQuoteRequest[]>('/quotes/requests/pending');
};

export const getUserOwnRequests = async (): Promise<UserOwnRequest[]> => {
  return apiRequest<UserOwnRequest[]>('/quotes/requests/own');
};

export const rejectQuoteRequest = async (requestId: string): Promise<void> => {
  await apiRequest(`/quotes/requests/${requestId}/reject`, { method: 'POST' });
};

// ─── Quote Responses ──────────────────────────────────────────────────────────

export const submitQuoteResponse = async (payload: QuoteResponsePayload): Promise<string> => {
  const result = await apiRequest<{ id: string }>('/quotes/responses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.id;
};

export const getUserReceivedQuotes = async (): Promise<ReceivedQuote[]> => {
  return apiRequest<ReceivedQuote[]>('/quotes/responses/received');
};

export const getStoreSentQuotes = async (): Promise<StoreSentQuote[]> => {
  return apiRequest<StoreSentQuote[]>('/quotes/responses/sent');
};

export const getRecentPendingQuotes = async (_maxResults = 3): Promise<RecentPendingQuote[]> => {
  try {
    return apiRequest<RecentPendingQuote[]>('/quotes/responses/received');
  } catch {
    return [];
  }
};

// ─── Quote Actions ────────────────────────────────────────────────────────────

export const acceptQuote = async (quoteId: string, requestId: string): Promise<AcceptQuoteResult> => {
  return apiRequest<AcceptQuoteResult>(`/quotes/${quoteId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
};

export const rejectQuote = async (quoteId: string, requestId: string): Promise<void> => {
  await apiRequest(`/quotes/${quoteId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
};

export const getWompiSignature = async (quoteId: string): Promise<{
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
}> => {
  return apiRequest(`/payments/wompi/signature/${quoteId}`);
};

export const verifyWompiPayment = async (quoteId: string, transactionId: string): Promise<void> => {
  await apiRequest(`/payments/verify`, {
    method: 'POST',
    body: JSON.stringify({ quoteId, transactionId }),
  });
};

export const updateQuoteLogisticStatus = async (quoteId: string, _requestId: string, status: string): Promise<void> => {
  await apiRequest(`/quotes/${quoteId}/logistic-status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
};

// ─── Price Catalog (memoria de precios de la tienda) ─────────────────────────

export const saveStorePriceCatalog = async (
  items: { name: string; price: number; sku: string | null }[]
): Promise<void> => {
  const catalog: Record<string, StoreCatalogEntry> = {};
  items.forEach(({ name, price, sku }) => {
    if (price > 0) catalog[name.toLowerCase().trim()] = { price, sku };
  });
  if (Object.keys(catalog).length === 0) return;
  await apiRequest('/stores/catalog/prices', {
    method: 'POST',
    body: JSON.stringify({ catalog }),
  });
};

export const getStorePriceCatalog = async (): Promise<Record<string, StoreCatalogEntry>> => {
  try {
    return await apiRequest<Record<string, StoreCatalogEntry>>('/stores/catalog/prices');
  } catch {
    return {};
  }
};

// ─── Payments ────────────────────────────────────────────────────────────────

export const submitManualPayment = async (params: {
  quoteId: string;
  requestId: string;
  method: string;
  amount: number;
  referenceNumber: string;
  proofFile?: File;
}): Promise<string> => {
  let proofBase64: string | undefined;
  if (params.proofFile) {
    proofBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(params.proofFile!);
    });
  }
  const result = await apiRequest<{ id: string }>('/payments/manual', {
    method: 'POST',
    body: JSON.stringify({
      quoteId: params.quoteId,
      requestId: params.requestId,
      reference: params.referenceNumber,
      proofBase64,
    }),
  });
  return result.id;
};

export const registerWompiPayment = async (params: {
  quoteId: string;
  requestId: string;
  amount: number;
  wompiReference: string;
}): Promise<string> => {
  const result = await apiRequest<{ id: string }>('/payments/wompi', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result.id;
};

export const confirmDelivery = async (
  quoteId: string,
  requestId: string,
  review: { rating: number; comment: string }
): Promise<void> => {
  await apiRequest(`/quotes/${quoteId}/status`, {
    method: 'POST',
    body: JSON.stringify({ requestId, ...review, status: 'DELIVERED' }),
  });
};
