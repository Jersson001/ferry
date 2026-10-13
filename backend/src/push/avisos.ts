import { Punto, distanciaKm } from '../quotes/ubicacion';

// Texto del aviso que recibe una ferretería. Sin datos del cliente: solo categoría y, si se sabe, la distancia.
export function textoDeAviso(categoria: string, tienda: Punto | null, obra: Punto | null): { title: string; body: string } {
  const km = tienda && obra ? Math.round(distanciaKm(tienda, obra) * 10) / 10 : null;
  return {
    title: 'Nueva solicitud en Ferry',
    body: km !== null ? `${categoria} · a ${km} km de tu ferretería. Responde primero: solo caben 5 cotizaciones.` : `${categoria}. Responde primero: solo caben 5 cotizaciones.`,
  };
}

// Un endpoint de push debe ser una URL https de un servicio de notificaciones, no una dirección interna:
// el servidor le hace una petición, así que aceptar cualquiera permitiría apuntarlo a su propia red.
export function endpointValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    return /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(u.hostname);
  } catch {
    return false;
  }
}
