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
