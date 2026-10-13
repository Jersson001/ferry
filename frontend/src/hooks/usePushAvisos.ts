import { useCallback, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export type EstadoAvisos = 'no-soportado' | 'inactivo' | 'activo' | 'bloqueado';

const claveABytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

const soportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Avisos del navegador cuando llega una solicitud de la categoría y la zona de la ferretería.
// No funciona dentro del WebView de la app Android: ahí aparece como 'no-soportado'.
export function usePushAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos>(soportado() ? 'inactivo' : 'no-soportado');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!soportado()) return;
    if (Notification.permission === 'denied') { setEstado('bloqueado'); return; }
    navigator.serviceWorker.getRegistration('/ferry-sw.js')
      .then(reg => reg?.pushManager.getSubscription())
      .then(sub => { if (sub) setEstado('activo'); })
      .catch(() => {});
  }, []);

  const activar = useCallback(async () => {
    if (!soportado()) return;
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'bloqueado' : 'inactivo'); return; }

      const { key } = await (await fetch(`${API_URL}/push/key`)).json();
      if (!key) throw new Error('Los avisos no están disponibles en este momento');

      const reg = await navigator.serviceWorker.register('/ferry-sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(key) }));

      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('No se pudo guardar la suscripción');
      setEstado('activo');
    } catch (e) {
      console.error('[Push] No se pudo activar:', e);
      setEstado('inactivo');
    } finally {
      setTrabajando(false);
    }
  }, []);

  const desactivar = useCallback(async () => {
    setTrabajando(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/ferry-sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const token = localStorage.getItem('access_token');
        await fetch(`${API_URL}/push/subscribe`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setEstado('inactivo');
    } finally {
      setTrabajando(false);
    }
  }, []);

  return { estado, trabajando, activar, desactivar };
}
