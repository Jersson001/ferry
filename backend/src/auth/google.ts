// ID de cliente OAuth web de Ferry en Google Cloud. Es público (viaja en el navegador); GOOGLE_CLIENT_ID lo cambia.
export const GOOGLE_CLIENT_ID_POR_DEFECTO = '976355293688-lk35h1fbk1o62ocmspnmrvacouo7qiv6.apps.googleusercontent.com';

export const clienteDeGoogle = (): string => process.env.GOOGLE_CLIENT_ID?.trim() || GOOGLE_CLIENT_ID_POR_DEFECTO;

export interface DatosDeGoogle {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

// Valida lo que devuelve https://oauth2.googleapis.com/tokeninfo para un ID token. Google ya comprobó la firma y la
// vigencia; aquí se exige que el token sea para ESTA app (aud), que venga de Google (iss) y que el correo esté
// verificado: sin eso, cualquiera podría entrar a una cuenta ajena con un correo que no es suyo.
export function datosDeTokenGoogle(info: any, clientId: string, ahora: Date = new Date()): DatosDeGoogle | null {
  if (!info || typeof info !== 'object') return null;
  if (info.aud !== clientId) return null;
  if (!EMISORES.includes(info.iss)) return null;
  if (!(Number(info.exp) * 1000 > ahora.getTime())) return null;
  if (!(info.email_verified === true || info.email_verified === 'true')) return null;
  const email = typeof info.email === 'string' ? info.email.trim().toLowerCase() : '';
  const sub = typeof info.sub === 'string' ? info.sub : '';
  if (!email.includes('@') || !sub) return null;
  const name = typeof info.name === 'string' ? info.name.trim().slice(0, 80) : '';
  const picture = typeof info.picture === 'string' && info.picture.startsWith('https://') ? info.picture : null;
  return { sub, email, name, picture };
}

export async function verificarTokenDeGoogle(credential: unknown): Promise<DatosDeGoogle | null> {
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    return datosDeTokenGoogle(await res.json(), clienteDeGoogle());
  } catch {
    return null;
  }
}
