import { categoriasDeLaTienda } from '../users/perfil';
import { estaEnRadio, leerUbicacion, Punto } from '../quotes/ubicacion';

export interface TiendaParaCobertura { specialties?: unknown; location?: unknown }

// Cuántas ferreterías recibirían una solicitud de esta categoría con este radio. Cuenta igual que la bandeja:
// una tienda sin coordenadas también la recibe.
export function contarTiendasQueCubren(tiendas: TiendaParaCobertura[], categoria: string, obra: Punto | null, radioKm: number): number {
  return tiendas.filter(t =>
    categoriasDeLaTienda(t.specialties).includes(categoria) &&
    estaEnRadio(leerUbicacion({ userLocation: t.location }), obra, radioKm),
  ).length;
}
