// Las mismas categorías que ofrece el flujo de solicitud en el frontend (MaterialFlow).
export const ESPECIALIDADES = [
  'Plomería', 'Eléctricos', 'Depósito', 'Pintura', 'Carpintería',
  'Iluminación', 'Cerrajería', 'Gas', 'Estructural', 'Herramientas',
];

const esTexto = (v: unknown): v is string => typeof v === 'string';
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Lo único que un usuario puede escribir en su propio perfil. Nunca el rol, el correo, la contraseña,
// los tokens ni la verificación del correo: la sesión confía en lo que hay en la base.
export function sanitizarPerfil(body: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};

  for (const campo of ['displayName', 'description', 'photoURL', 'phoneNumber', 'rut'] as const) {
    if (esTexto(body[campo])) limpio[campo] = body[campo];
  }

  if (Array.isArray(body.specialties)) {
    limpio.specialties = Array.from(new Set(body.specialties.filter(esTexto))).filter(s => ESPECIALIDADES.includes(s));
  }

  if (Array.isArray(body.families)) {
    limpio.families = body.families.filter(esTexto);
  }

  // La dirección puede llegar sola: una ferretería recién registrada la escribe antes de tener coordenadas.
  const ubicacion = body.location as { lat?: unknown; lng?: unknown; address?: unknown } | undefined;
  if (ubicacion && typeof ubicacion === 'object') {
    const conCoordenadas = esNumero(ubicacion.lat) && esNumero(ubicacion.lng);
    const conDireccion = esTexto(ubicacion.address);
    if (conCoordenadas || conDireccion) {
      limpio.location = {
        ...(conCoordenadas ? { lat: ubicacion.lat, lng: ubicacion.lng } : {}),
        ...(conDireccion ? { address: ubicacion.address } : {}),
      };
    }
  }

  return limpio;
}
