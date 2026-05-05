import { db } from '../firebase';
import {
  collection, doc, writeBatch, getDocs, query, where,
  serverTimestamp, deleteDoc,
} from 'firebase/firestore';

export interface CatalogProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image: string;
  isOnOffer?: boolean;
  discountPercent?: number; // 0-100
  family?: string; // familia / grupo de productos (ej: 'Herrajes Cocina', 'Closets')
}

export interface CatalogProductStored extends CatalogProduct {
  storeId: string;
  updatedAt: any;
}

// ─── Upsert (insert or update) by storeId + sku ───────────────────────────────
// Accepts a single product or an array. Uses Firestore batch (max 500 per batch).
export const upsertProducts = async (
  storeId: string,
  products: CatalogProduct[],
): Promise<void> => {
  const BATCH_SIZE = 400;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const product of chunk) {
      const docId = `${storeId}_${product.sku.trim().toUpperCase()}`;
      const ref = doc(db, 'catalog', docId);
      batch.set(ref, {
        ...product,
        sku: product.sku.trim().toUpperCase(),
        storeId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }
};

// ─── Fetch all products for a store ──────────────────────────────────────────
export const getStoreCatalogProducts = async (
  storeId: string,
): Promise<CatalogProductStored[]> => {
  const snap = await getDocs(
    query(collection(db, 'catalog'), where('storeId', '==', storeId)),
  );
  return snap.docs.map(d => d.data() as CatalogProductStored);
};

// ─── Delete a single product ──────────────────────────────────────────────────
export const deleteCatalogProduct = async (
  storeId: string,
  sku: string,
): Promise<void> => {
  const docId = `${storeId}_${sku.trim().toUpperCase()}`;
  await deleteDoc(doc(db, 'catalog', docId));
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

  // Primary: gviz/tq endpoint — works for publicly shared sheets without requiring "Publish to web"
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  try {
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 0) return text;
    }
  } catch { /* fall through */ }

  // Fallback: export endpoint — requires "Publish to web"
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res2 = await fetch(exportUrl);
  if (!res2.ok) {
    throw new Error(
      'No se pudo acceder a la hoja. Asegúrate de que esté compartida como "Cualquiera con el enlace puede ver" (botón Compartir → General access).',
    );
  }
  return res2.text();
};

// ─── Format image URL: converts Google Drive viewer links to direct embed ─────
/**
 * Detects Google Drive viewer URLs (/file/d/{id}/view) and rewrites them
 * to the direct-view format so <img src> can load the file.
 *
 * Input:  https://drive.google.com/file/d/1fBv-hBF.../view?usp=drive_link
 * Output: https://drive.google.com/uc?export=view&id=1fBv-hBF...
 *
 * Any non-Drive URL is returned unchanged.
 */
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
