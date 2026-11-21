import { categoriasDeLaTienda } from '../users/perfil';
import { estaEnRadio, leerUbicacion, Punto } from '../quotes/ubicacion';

export interface TiendaParaCobertura { specialties?: unknown; location?: unknown }

// Cuántas ferreterías recibirían una solicitud de esta categoría con este radio. Cuenta igual que la bandeja:
// una tienda sin coordenadas también la recibe.
// `categoria` puede traer dos tiendas expertas separadas por coma: cuenta las que cubren cualquiera.
export function contarTiendasQueCubren(tiendas: TiendaParaCobertura[], categoria: string, obra: Punto | null, radioKm: number): number {
  const pedidas = categoria.split(',').map(c => c.trim()).filter(Boolean);
  return tiendas.filter(t =>
    categoriasDeLaTienda(t.specialties).some(c => pedidas.includes(c)) &&
    estaEnRadio(leerUbicacion({ userLocation: t.location }), obra, radioKm),
  ).length;
}
