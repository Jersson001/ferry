export interface FilaCatalogoPublico {
  id: string;
  name: string;
  price: number | string;
  stock: number | string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  isOnOffer: boolean;
  discountPercent: number | string;
}

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esIdValido = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

// Lo que ve quien escanea el QR: nombre, foto, categoría y precio. Nunca SKU, costo ni cantidad en bodega.
// Los agotados no se muestran: prometer algo que no hay es peor que no mostrarlo.
export function armarCatalogoPublico(filas: FilaCatalogoPublico[]): ProductoPublico[] {
  const productos: ProductoPublico[] = [];
  for (const f of filas) {
    const precio = Number(f.price);
    if (!Number.isFinite(precio) || precio <= 0) continue;
    if (!(Number(f.stock) > 0)) continue;
    const descuento = f.isOnOffer ? Number(f.discountPercent) : 0;
    const valido = Number.isFinite(descuento) && descuento >= 1 && descuento <= 99;
    productos.push({
      id: f.id,
      name: f.name,
      price: precio,
      finalPrice: valido ? Math.round(precio * (1 - descuento / 100)) : precio,
      discountPercent: valido ? Math.round(descuento) : 0,
      category: f.category || 'General',
      description: f.description || '',
      image: f.imageUrl || null,
    });
  }
  return productos;
}
