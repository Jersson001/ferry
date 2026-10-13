// Ubicación de la obra y radio de cobertura que elige el cliente.

export const RADIO_POR_DEFECTO_KM = 10;
export const RADIO_MAXIMO_KM = 50;

export interface Punto { lat: number; lng: number }

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// El frontend manda { userLocation: { lat, lng } }; también se aceptan userLat / userLng sueltos.
export function leerUbicacion(data: any): Punto | null {
  const lat = numero(data?.userLocation?.lat ?? data?.userLat);
  const lng = numero(data?.userLocation?.lng ?? data?.userLng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function leerRadioKm(valor: unknown): number {
  const n = numero(valor);
  if (n === null || n <= 0) return RADIO_POR_DEFECTO_KM;
  return Math.min(Math.round(n), RADIO_MAXIMO_KM);
}

export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Una tienda ve la solicitud si cae dentro del radio que fijó el cliente. Si falta la ubicación de cualquiera de
// los dos no se puede medir, y se deja pasar: es mejor una cotización de más que una tienda sin servicio.
export function estaEnRadio(tienda: Punto | null, obra: Punto | null, radioKm: number): boolean {
  if (!tienda || !obra) return true;
  return distanciaKm(tienda, obra) <= radioKm;
}
