/**
 * catalogService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión del catálogo de productos — 100% via REST API (NestJS).
 * No usa Firebase. El token JWT se lee directamente de localStorage.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

export interface CatalogProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image: string;
  isOnOffer?: boolean;
  discountPercent?: number;
  family?: string;
}

export interface CatalogProductStored extends CatalogProduct {
  storeId: string;
  updatedAt?: any;
  id?: string;
}

// ─── Upsert (insert or update) by storeId + sku ───────────────────────────────
export const upsertProducts = async (
  storeId: string,
  products: CatalogProduct[],
): Promise<void> => {
  await apiRequest(`/stores/${storeId}/catalog`, {
    method: 'POST',
    body: JSON.stringify({ products }),
  });
};

// ─── Fetch all products for a store ──────────────────────────────────────────
export const getStoreCatalogProducts = async (
  storeId: string,
): Promise<CatalogProductStored[]> => {
  return apiRequest<CatalogProductStored[]>(`/stores/${storeId}/catalog`);
};

// ─── Delete a single product ──────────────────────────────────────────────────
export const deleteCatalogProduct = async (
  storeId: string,
  sku: string,
): Promise<void> => {
  await apiRequest(`/stores/${storeId}/catalog/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
  });
};

// ─── Validate and normalize a raw row from CSV/Excel ─────────────────────────
export const normalizeRow = (raw: Record<string, any>): CatalogProduct | null => {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (val !== undefined && val !== '') return String(val).trim();
    }
    return '';
  };
  const sku = get('sku', 'SKU', 'referencia', 'Referencia', 'REF');
  const name = get('nombre', 'name', 'Nombre', 'NOMBRE', 'producto', 'Producto');
  const priceRaw = get('precio', 'price', 'Precio', 'PRECIO', 'valor', 'Valor');
  const price = parseFloat(priceRaw.replace(/[^\d.]/g, '')) || 0;
  const stock = parseInt(get('stock', 'Stock', 'STOCK', 'cantidad', 'Cantidad')) || 0;

  if (!sku || !name) return null;

  return {
    sku,
    name,
    price,
    stock,
    category: get('categoria', 'category', 'Categoria', 'Categoría', 'CATEGORIA') || 'General',
    description: get('descripcion', 'description', 'Descripcion', 'Descripción', 'DESCRIPCION') || '',
    image: get('imagen', 'image', 'Imagen', 'IMAGEN', 'foto', 'url') || '',
  };
};

// ─── Parse a public Google Sheets URL and return CSV text ────────────────────
export const fetchGoogleSheetCsv = async (url: string): Promise<string> => {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  if (!idMatch) throw new Error('URL de Google Sheets inválida.');

  const spreadsheetId = idMatch[1];
  const gid = gidMatch?.[1] ?? '0';

  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  try {
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 0) return text;
    }
  } catch { /* fall through */ }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res2 = await fetch(exportUrl);
  if (!res2.ok) {
    throw new Error(
      'No se pudo acceder a la hoja. Asegúrate de que esté compartida como "Cualquiera con el enlace puede ver".',
    );
  }
  return res2.text();
};

// ─── Format image URL: converts Google Drive viewer links to direct embed ─────
export const formatImageUrl = (url: string): string => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  return url;
};

// ─── Download a blank CSV template ───────────────────────────────────────────
export const downloadCsvTemplate = () => {
  const header = 'sku,nombre,precio,stock,categoria,descripcion,imagen';
  const example = 'CEM-001,Cemento Gris Argos 50kg,28500,100,Obra Civil,Uso general,https://...';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plantilla_catalogo_ferry.csv';
  link.click();
};
