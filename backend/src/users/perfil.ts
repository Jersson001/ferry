// Las mismas categorías que ofrece el flujo de solicitud en el frontend (MaterialFlow).
export const ESPECIALIDADES = [
  'Plomería', 'Eléctricos', 'Depósito', 'Pintura', 'Carpintería',
  'Iluminación', 'Cerrajería', 'Gas', 'Estructural', 'Herramientas',
];

const esTexto = (v: unknown): v is string => typeof v === 'string';
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Lo que otra cuenta puede ver de un usuario cuando el pedido ya se pagó: contacto y presentación, nunca
// la contraseña, los tokens ni la lista de precios privada.
export function contactoPublico(usuario: any) {
  if (!usuario) return undefined;
  const { uid, displayName, phoneNumber, photoURL, description, location, specialties } = usuario;
  return { uid, displayName, phoneNumber, photoURL, description, location, specialties };
}

// Lo que se le devuelve a una persona sobre su propia cuenta. Sin la contraseña ni los tokens: no tienen
// por qué viajar al navegador, que los guardaría en localStorage.
export function perfilPropio(usuario: any) {
  if (!usuario) return usuario;
  const {
    uid, email, displayName, role, phoneNumber, isEmailVerified, isProfileComplete,
    location, description, specialties, photoURL, rut, families, createdAt,
  } = usuario;
  return {
    uid, email, displayName, role, phoneNumber, isEmailVerified, isProfileComplete,
    location, description, specialties, photoURL, rut, families, createdAt,
  };
}

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
