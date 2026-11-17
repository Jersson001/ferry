// Topes de cotizaciones. Mientras no estén definidos los planes, todos usan el tope gratuito.

// Cotizaciones que puede recibir una solicitud. Las toma quien responde primero.
export const COTIZACIONES_POR_SOLICITUD = 5;

// Cotizaciones que una ferretería sin plan de pago puede enviar por día.
export const COTIZACIONES_DIARIAS_GRATIS = 5;

// Una solicitud solo se puede cotizar durante su primera hora (desde que se publicó o se volvió a enviar).
// Después deja de verse en la bandeja de las ferreterías; el cliente la conserva y puede volver a enviarla.
export const VIGENCIA_SOLICITUD_MS = 60 * 60 * 1000;

export const publicadaEn = (r: { publishedAt?: Date | null; createdAt: Date }): Date => r.publishedAt ?? r.createdAt;

export const solicitudVigente = (r: { publishedAt?: Date | null; createdAt: Date }, ahora: Date = new Date()): boolean =>
  ahora.getTime() - new Date(publicadaEn(r)).getTime() < VIGENCIA_SOLICITUD_MS;

const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000; // Colombia es UTC-5 todo el año

// Instante (UTC) en que empezó el día de hoy en Colombia: el cupo diario se reinicia a medianoche local, no a la UTC.
export function inicioDelDiaColombia(ahora: Date = new Date()): Date {
  const local = ahora.getTime() - OFFSET_BOGOTA_MS;
  const medianocheLocal = local - (((local % 86_400_000) + 86_400_000) % 86_400_000);
  return new Date(medianocheLocal + OFFSET_BOGOTA_MS);
}

export interface ItemCotizado {
  storeBaseUnitPrice: unknown;
  quantity: unknown;
  available?: unknown;
}

// Revisa lo que la ferretería manda: el servidor calcula los totales, así que un precio negativo o con texto
// cambiaría el total que paga el cliente.
export function itemsDeCotizacionValidos(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return 'La cotización debe traer al menos un artículo';
  if (items.length > 200) return 'La cotización trae demasiados artículos';
  for (const item of items as ItemCotizado[]) {
    const precio = item?.storeBaseUnitPrice;
    const cantidad = item?.quantity;
    if (typeof precio !== 'number' || !Number.isFinite(precio) || precio < 0 || precio > 1_000_000_000) {
      return 'Hay un precio inválido en la cotización';
    }
    if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000) {
      return 'Hay una cantidad inválida en la cotización';
    }
  }
  return null;
}
