import React, { useEffect, useRef, useState } from 'react';
import { signInWithGoogle, FerryRole, AuthResult } from '../services/authService';

// ID de cliente OAuth web de Ferry. Es público: viaja en el navegador de todos.
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '976355293688-lk35h1fbk1o62ocmspnmrvacouo7qiv6.apps.googleusercontent.com';

const SCRIPT = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: any;
  }
}

// Google bloquea su inicio de sesión dentro de un WebView (error disallowed_useragent): en la app
// de Android el botón fallaría, así que ahí no se muestra. En el navegador sí.
const enWebView = () => /; wv\)|\bwv\b/.test(navigator.userAgent);

const cargarScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const previo = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const s = previo ?? Object.assign(document.createElement('script'), { src: SCRIPT, async: true, defer: true });
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('No se pudo cargar Google')));
    if (!previo) document.head.appendChild(s);
  });

interface Props {
  role: FerryRole;
  onSuccess: (r: AuthResult) => void;
  onError: (mensaje: string) => void;
}

// Botón oficial "Continuar con Google". Si no puede cargar o está en la app de Android, no ocupa lugar.
export const BotonGoogle: React.FC<Props> = ({ role, onSuccess, onError }) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const rol = useRef(role);
  rol.current = role;

  useEffect(() => {
    if (!CLIENT_ID || enWebView()) return;
    let cancelado = false;
    cargarScript()
      .then(() => {
        if (cancelado || !contenedor.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential) return onError('Google no devolvió tu cuenta. Intenta de nuevo.');
            try {
              onSuccess(await signInWithGoogle(resp.credential, rol.current === 'ferreteria' ? 'STORE' : 'USER'));
            } catch (e: any) {
              onError(e?.message || 'No se pudo entrar con Google.');
            }
          },
        });
        window.google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          locale: 'es',
          width: Math.min(contenedor.current.clientWidth || 320, 400),
        });
        setListo(true);
      })
      .catch(() => { /* sin Google (red o bloqueador): queda el correo */ });
    return () => { cancelado = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!CLIENT_ID || enWebView()) return null;

  return (
    <div className={listo ? 'space-y-3' : 'hidden'}>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex-1 h-px bg-slate-200" /> o <span className="flex-1 h-px bg-slate-200" />
      </div>
      <div ref={contenedor} className="flex justify-center min-h-[44px]" />
    </div>
  );
};

export default BotonGoogle;
