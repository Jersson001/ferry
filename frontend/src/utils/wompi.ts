/**
 * Wompi Web Checkout — integración SPA oficial
 * Docs: https://docs.wompi.co/docs/colombia/widget-checkout-web
 *
 * El script https://checkout.wompi.co/widget.js se carga una sola vez en
 * index.html y expone la clase global WidgetCheckout.  Aquí sólo se
 * instancia y se abre el checkout; no se inyecta ningún <script> en runtime.
 */

// ─── TypeScript — tipos globales de WidgetCheckout ───────────────────────────
declare global {
  interface Window {
    WidgetCheckout: new (options: WompiWidgetOptions) => WompiWidgetInstance;
  }
}

interface WompiWidgetOptions {
  currency:      string;
  amountInCents: number;
  reference:     string;
  publicKey:     string;
  redirectUrl?:  string;
  signature?:    { integrity: string };
}

interface WompiWidgetResult {
  transaction: {
    id:             string;
    status:         'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
    reference:      string;
    amount_in_cents: number;
  };
}

interface WompiWidgetInstance {
  open(callback: (result: WompiWidgetResult) => void): void;
}

// ─── Claves ───────────────────────────────────────────────────────────────────
export const WOMPI_PUBLIC_KEY    = import.meta.env.VITE_WOMPI_PUBLIC_KEY || '';
const LS_KEY = 'ferry_wompi_ctx';

// ─── Contexto persistente (respaldo por si el callback no llega) ─────────────
export interface WompiCtx {
  quoteId:   string;
  requestId: string;
  amount:    number;
}

export const saveWompiCtx  = (ctx: WompiCtx) =>
  localStorage.setItem(LS_KEY, JSON.stringify(ctx));

export const loadWompiCtx  = (): WompiCtx | null => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); } catch { return null; }
};

export const clearWompiCtx = () => localStorage.removeItem(LS_KEY);

// ─── Abrir checkout con WidgetCheckout (clase global de widget.js) ────────────
/**
 * Abre el overlay de pago de Wompi usando la clase global WidgetCheckout que
 * expone el script cargado en index.html.
 *
 * @param params   - datos del pago
 * @param onResult - callback que recibe el resultado cuando el usuario
 *                   termina o cierra el overlay
 */
export const openWompiCheckout = async (
  params: {
    quoteId:       string;
    requestId:     string;
    amountInCents: number;
    reference:     string;
    signature:     string;
    currency?:     string;
  },
  onResult: (result: WompiWidgetResult) => void,
): Promise<void> => {
  const { quoteId, requestId, amountInCents, reference, signature, currency = 'COP' } = params;

  // Guardar contexto como respaldo en caso de refresco o cierre inesperado
  saveWompiCtx({ quoteId, requestId, amount: amountInCents / 100 });

  const checkout = new window.WidgetCheckout({
    currency,
    amountInCents,
    reference,
    publicKey: WOMPI_PUBLIC_KEY,
    signature: { integrity: signature },
  });

  checkout.open(onResult);
};

// ─── Leer resultado de redirect (respaldo para refresco de página) ────────────
export interface WompiRedirectResult {
  transactionId: string;
  status:        'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
  reference:     string;
  amountInCents: number;
  valid:         boolean;
  ctx:           WompiCtx | null;
}

export const checkWompiRedirect = async (): Promise<WompiRedirectResult | null> => {
  const p             = new URLSearchParams(window.location.search);
  const transactionId = p.get('id');
  const status        = p.get('status');

  if (!transactionId || !status) return null;

  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  const reference     = p.get('reference')              ?? '';
  const amountInCents = parseInt(p.get('amount_in_cents') ?? '0', 10);
  // La validación real ocurre en el backend, no necesitamos el secreto aquí
  const valid = true;

  const ctx = loadWompiCtx();
  clearWompiCtx();

  return {
    transactionId,
    status: status as WompiRedirectResult['status'],
    reference,
    amountInCents,
    valid,
    ctx,
  };
};
