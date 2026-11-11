export interface FilaPromocion {
  id: string;
  name: string;
  price: number | string;
  discountPercent: number | string;
  stock: number | string;
  category: string | null;
  imageUrl: string | null;
  storeId: string;
  storeName: string | null;
  storePhoto: string | null;
  specialties: string | null;
  location: { lat: number; lng: number; address?: string } | null;
}

export interface Promocion {
  id: string;
  name: string;
  price: number;
  discountPercent: number;
  finalPrice: number;
  category: string;
  image: string | null;
  storeId: string;
  storeName: string;
  storePhoto: string | null;
  specialties: string[];
  location: { lat: number; lng: number; address?: string } | null;
}

// Una promoción solo se publica con un descuento real y producto disponible; el resto se descarta.
export function armarPromociones(filas: FilaPromocion[], limite: number): Promocion[] {
  const promociones: Promocion[] = [];
  for (const f of filas) {
    const precio = Number(f.price);
    const descuento = Number(f.discountPercent);
    if (!Number.isFinite(precio) || precio <= 0) continue;
    if (!Number.isFinite(descuento) || descuento < 1 || descuento > 99) continue;
    if (!(Number(f.stock) > 0)) continue;
    const especialidades = f.specialties ? f.specialties.split(',').map(s => s.trim()).filter(Boolean) : [];
    promociones.push({
      id: f.id,
      name: f.name,
      price: precio,
      discountPercent: Math.round(descuento),
      finalPrice: Math.round(precio * (1 - descuento / 100)),
      category: f.category || 'General',
      image: f.imageUrl || null,
      storeId: f.storeId,
      storeName: f.storeName || 'Ferretería',
      storePhoto: f.storePhoto || null,
      specialties: especialidades,
      location: f.location || null,
    });
    if (promociones.length >= limite) break;
  }
  return promociones;
}
