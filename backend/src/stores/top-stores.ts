export interface FilaCalificacion {
  id: string;
  name: string;
  photoUrl: string | null;
  specialties: string | null;
  location: { lat: number; lng: number; address?: string } | null;
  average: string | number;
  reviews: string | number;
}

export interface TiendaTop {
  id: string;
  name: string;
  photoUrl: string | null;
  specialties: string[];
  location: { lat: number; lng: number; address?: string } | null;
  rating: number;
  reviews: number;
}

// Cada tienda parte de un promedio previo exigente, equivalente a PESO_PREVIO calificaciones de 4.0, y
// lo va dejando atrás a medida que acumula reseñas. Así una sola calificación de 5 no la pone por encima
// de otra con muchas de 4.8. Es fijo y no el promedio de todas: si casi todas son altas, ese promedio
// también lo sería y no frenaría a nadie.
const PROMEDIO_PREVIO = 4.0;
const PESO_PREVIO = 3;

export function ordenarTiendasPorCalificacion(filas: FilaCalificacion[], limite: number): TiendaTop[] {
  return filas
    .map(f => ({ fila: f, promedio: Number(f.average), cantidad: Number(f.reviews) }))
    .filter(t => Number.isFinite(t.promedio) && t.cantidad > 0)
    .map(t => ({
      ...t,
      puntaje: (t.cantidad * t.promedio + PESO_PREVIO * PROMEDIO_PREVIO) / (t.cantidad + PESO_PREVIO),
    }))
    .sort((a, b) => b.puntaje - a.puntaje || b.cantidad - a.cantidad || a.fila.name.localeCompare(b.fila.name))
    .slice(0, limite)
    .map(t => ({
      id: t.fila.id,
      name: t.fila.name,
      photoUrl: t.fila.photoUrl || null,
      specialties: t.fila.specialties ? t.fila.specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
      location: t.fila.location || null,
      rating: Math.round(t.promedio * 10) / 10,
      reviews: t.cantidad,
    }));
}
