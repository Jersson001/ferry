import QRCode from 'qrcode';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export interface ProductoPublico {
  id: string;
  name: string;
  price: number;
  finalPrice: number;
  discountPercent: number;
  category: string;
  description: string;
  image: string | null;
}

export interface CatalogoPublicoData {
  store: { id: string; name: string; photoUrl: string | null; specialties: string[] };
  products: ProductoPublico[];
}

// Enlace estable por tienda: el QR impreso sigue sirviendo aunque el catálogo cambie.
export const enlaceDelCatalogo = (storeId: string) => `${window.location.origin}/catalogo/${storeId}`;

// Público: sin sesión. Devuelve null si la tienda no existe o la consulta falla.
export const getCatalogoPublico = async (storeId: string): Promise<CatalogoPublicoData | null> => {
  try {
    const res = await fetch(`${API_URL}/stores/${encodeURIComponent(storeId)}/public-catalog`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};

// El QR se dibuja en el navegador: el enlace de la tienda no se manda a ningún servicio externo.
export const qrComoImagen = (texto: string, ancho = 512): Promise<string> =>
  QRCode.toDataURL(texto, { width: ancho, margin: 2, errorCorrectionLevel: 'M' });

// Cuenta la apertura del catálogo una vez por pestaña. `?via=qr` distingue a quien escaneó el QR; si falla, no importa.
export const registrarVisita = (storeId: string): void => {
  try {
    const clave = `ferry_visita_${storeId}`;
    if (sessionStorage.getItem(clave)) return;
    sessionStorage.setItem(clave, '1');
    const via = new URLSearchParams(window.location.search).get('via') === 'qr' ? 'qr' : 'link';
    fetch(`${API_URL}/stores/${encodeURIComponent(storeId)}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via }),
    }).catch(() => undefined);
  } catch { /* sin almacenamiento o red: no afecta al visitante */ }
};
