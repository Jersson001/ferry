import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'react-qr-code';
import {
  Inbox, RefreshCw, Store, Package, CheckCircle2, X,
  ChevronDown, ChevronUp, MessageSquare, Loader2,
  AlertCircle, AlertTriangle, ThumbsUp, Clock, MapPin, CreditCard, ShieldCheck,
  Truck, Plus, Bell, FileText, Search, PackageCheck,
  Upload, Smartphone, Copy, Download, Star,
} from 'lucide-react';
import {
  openWompiCheckout,
  WOMPI_PUBLIC_KEY,
  checkWompiRedirect,
} from '../utils/wompi';
import {
  getUserReceivedQuotes,
  getUserOwnRequests,
  acceptQuote,
  rejectQuote,
  verifyWompiPayment,
  updateQuoteLogisticStatus,
  formatRelativeTime,
  submitManualPayment,
  confirmDelivery,
  getWompiSignature,
  ReceivedQuote,
  QuoteResponseItem,
  AcceptQuoteResult,
  UserOwnRequest,
} from '../services/quoteService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCOP = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);

const CATEGORY_COLORS: Record<string, string> = {
  'Plomería':     'bg-blue-100 text-blue-700',
  'Eléctricos':   'bg-yellow-100 text-yellow-700',
  'Carpintería':  'bg-amber-100 text-amber-700',
  'Depósito':     'bg-slate-100 text-slate-700',
  'Pintura':      'bg-purple-100 text-purple-700',
  'Iluminación':  'bg-orange-100 text-orange-700',
  'Estructural':  'bg-red-100 text-red-700',
  'Cerrajería':   'bg-teal-100 text-teal-700',
  'Gas':          'bg-cyan-100 text-cyan-700',
};
const categoryColor = (cat: string) =>
  CATEGORY_COLORS[cat] ?? 'bg-ferry-100 text-ferry-700';

// Store initials avatar (revealed only after acceptance)
const StoreAvatar: React.FC<{ name?: string }> = ({ name }) => {
  const safeName = name || 'Ferretería';
  const initials = safeName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-ferry-500 to-ferry-700 flex items-center justify-center flex-shrink-0 shadow-sm">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
};

// Anonymous avatar shown before acceptance
const BlindAvatar: React.FC = () => (
  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
    <Store className="w-5 h-5 text-white" />
  </div>
);

// ---------------------------------------------------------------------------
// Review / Delivery Confirmation Modal
// ---------------------------------------------------------------------------

const StarRating: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="transition-transform hover:scale-110 active:scale-95"
      >
        <Star
          className={`w-9 h-9 transition-colors ${
            n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'
          }`}
        />
      </button>
    ))}
  </div>
);

const RATING_LABELS: Record<number, string> = {
  1: 'Muy malo',
  2: 'Malo',
  3: 'Regular',
  4: 'Bueno',
  5: '¡Excelente!',
};

const ReviewModal: React.FC<{
  quote: ReceivedQuote;
  onClose: () => void;
  onSubmit: (quoteId: string, requestId: string, rating: number, comment: string) => Promise<void>;
}> = ({ quote, onClose, onSubmit }) => {
  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await onSubmit(quote.id, quote.requestId, rating, comment);
      onClose();
    } catch (e: any) {
      setSaveError(e?.message ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 px-5 py-6 space-y-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2 mb-1" />

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-3xl">🎉</div>
          <h3 className="text-lg font-bold text-slate-800">¡Qué bueno que llegó tu pedido!</h3>
          <p className="text-sm text-slate-500">
            Califica el servicio de <strong>{quote.storeName}</strong>
          </p>
        </div>

        {/* Stars */}
        <div className="flex flex-col items-center gap-2">
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="text-sm font-semibold text-amber-600 animate-in fade-in duration-200">
              {RATING_LABELS[rating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Comentario opcional
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="¿Cómo fue la experiencia? ¿Llegó completo? ¿Fue puntual?"
            rows={3}
            className="mt-1.5 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 resize-none"
          />
        </div>

        {saveError && (
          <p className="text-xs text-red-500 text-center">{saveError}</p>
        )}

        {/* Actions */}
        <div className="space-y-2 pb-safe">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
              disabled:bg-slate-100 disabled:text-slate-400
              bg-ferry-600 hover:bg-ferry-700 text-white shadow-lg shadow-ferry-200/60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : rating === 0 ? (
              <>Confirmar entrega sin calificar</>
            ) : (
              <><Star className="w-4 h-4 fill-white" /> Enviar calificación y cerrar pedido</>
            )}
          </button>
          {!saving && (
            <button onClick={onClose} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Payment Checkout Modal
// ---------------------------------------------------------------------------

type ManualMethod = 'nequi';
type PayMethod = ManualMethod | 'wompi';

const NEQUI_KEY = '0091829443';

const PaymentCheckoutModal: React.FC<{
  quote: ReceivedQuote;
  alias: string;
  onClose: () => void;
  onPaymentSuccess: (quote: ReceivedQuote) => Promise<AcceptQuoteResult>;
  onWompiApproved: (transactionId: string) => void;
  onManualPaymentSuccess: (quoteId: string) => void;
}> = ({ quote, onClose, onPaymentSuccess: _onPaymentSuccess, onWompiApproved, onManualPaymentSuccess }) => {
  const [selectedMethod, setSelectedMethod] = useState<PayMethod | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(NEQUI_KEY).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('ferry-qr-svg');
    if (!svg) return;
    const svgData  = new XMLSerializer().serializeToString(svg);
    const canvas   = document.createElement('canvas');
    canvas.width   = 600;
    canvas.height  = 600;
    const ctx      = canvas.getContext('2d')!;
    const img      = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 0, 0, 600, 600);
      const link     = document.createElement('a');
      link.download  = 'ferry-qr-nequi-breb.png';
      link.href      = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const transport = quote.transportCost ?? 0;
  const subtotal = quote.total - transport;
  const availableCount = quote.items.filter(i => i.available).length;
  const amountInCents = Math.round(quote.total * 100);

  const isManual = selectedMethod === 'nequi';

  const handleWompiRedirect = async () => {
    setPayError(null);
    setProcessing(true);
    try {
      // 1. Obtener firma segura desde el backend
      const { reference, signature, amountInCents: backendAmountInCents } = await getWompiSignature(quote.id);
      
      // 2. Abrir checkout con la información provista por el backend
      await openWompiCheckout(
        { 
          quoteId: quote.id, 
          requestId: quote.requestId, 
          amountInCents: backendAmountInCents,
          reference,
          signature
        },
        (result) => {
          if (result.transaction.status === 'APPROVED') {
            onClose();
            onWompiApproved(result.transaction.id);
          }
          // DECLINED / ERROR / VOIDED: el overlay de Wompi ya muestra el mensaje;
          // el modal de Ferry se deja abierto para que el usuario elija otro método.
        },
      );
    } catch (err: any) {
      console.error('[Ferry/Wompi] error al abrir checkout:', err);
      setPayError(err.message || 'Error al iniciar pago seguro con Wompi');
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = e => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit = isManual && proofFile;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPayError(null);
    setProcessing(true);
    try {
      // Timeout de 30s — evita que Storage cuelgue silenciosamente por reglas bloqueadas
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado. Verifica tu conexión.')), 30_000),
      );
      await Promise.race([
        submitManualPayment({
          quoteId:         quote.id,
          requestId:       quote.requestId,
          method:          'nequi',
          amount:          quote.total,
          referenceNumber,
          proofFile:       proofFile!,
        }),
        timeout,
      ]);
      onManualPaymentSuccess(quote.id);
      setSuccess(true);
    } catch (e: any) {
      console.error('[Ferry/ManualPayment]', e);
      setPayError(e?.message ?? 'No se pudo enviar el comprobante. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">¡Comprobante enviado!</h2>
          <p className="text-sm text-slate-500 mb-3">Estamos validando tu pago. Te notificaremos cuando sea confirmado.</p>
          {quote.requestDisplayId && (
            <p className="text-xs text-slate-400 font-mono mb-3">Ref: {quote.requestDisplayId}</p>
          )}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-5 flex items-start gap-2 text-left">
            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Validación en un plazo de <strong>2–4 horas hábiles</strong>.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-ferry-600 text-white font-bold hover:bg-ferry-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // ── Checkout sheet ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!processing ? onClose : undefined}
      />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] flex flex-col">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ferry-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-ferry-600" />
            </div>
            <h3 className="font-bold text-slate-800">Pagar cotización</h3>
          </div>
          {!processing && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 no-scrollbar">

          {/* Amount summary */}
          <div className="bg-ferry-50 rounded-2xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal · {availableCount} ítems</span>
              <span className="font-semibold text-slate-700">{formatCOP(subtotal)}</span>
            </div>
            {transport > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-slate-500"><Truck className="w-3.5 h-3.5" /> Envío</span>
                <span className="font-semibold text-slate-700">{formatCOP(transport)}</span>
              </div>
            )}
            <div className="border-t border-ferry-100 pt-1.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">Total</span>
              <span className="text-xl font-bold text-ferry-700">{formatCOP(quote.total)}</span>
            </div>
          </div>

          {/* Step 1 — Method selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">

              {/* Nequi / Bre-B */}
              <button
                onClick={() => setSelectedMethod('nequi')}
                className={`relative flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                  selectedMethod === 'nequi'
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Smartphone className={`w-5 h-5 ${selectedMethod === 'nequi' ? 'text-purple-700' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${selectedMethod === 'nequi' ? 'text-purple-700' : 'text-slate-700'}`}>
                  Nequi / Bre-B
                </span>
                <span className="text-[10px] text-slate-400">Escanea y paga</span>
                {selectedMethod === 'nequi' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center bg-purple-50 border border-purple-300">
                    <CheckCircle2 className="w-3 h-3 text-purple-700" />
                  </div>
                )}
              </button>

              {/* Wompi */}
              <button
                onClick={() => setSelectedMethod('wompi')}
                className={`relative flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                  selectedMethod === 'wompi'
                    ? 'border-green-400 bg-green-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <CreditCard className={`w-5 h-5 ${selectedMethod === 'wompi' ? 'text-green-700' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${selectedMethod === 'wompi' ? 'text-green-700' : 'text-slate-700'}`}>
                  Wompi
                </span>
                <span className="text-[10px] text-slate-400">Tarjeta · PSE · Nequi</span>
                {selectedMethod === 'wompi' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center bg-green-50 border border-green-400">
                    <CheckCircle2 className="w-3 h-3 text-green-700" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Step 2 — Wompi (redirect directo, sin widget script) */}
          {selectedMethod === 'wompi' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
              <div>
                <p className="text-xs font-semibold text-green-700 mb-0.5">Pago seguro con Wompi</p>
                <p className="text-xs text-green-600">
                  El monto de <strong>{formatCOP(quote.total)}</strong> se pre-carga automáticamente.
                  Acepta tarjetas, PSE y Nequi.
                </p>
              </div>
              <button
                onClick={handleWompiRedirect}
                disabled={!WOMPI_PUBLIC_KEY}
                className="w-full py-3 rounded-xl bg-[#7B3FF2] hover:bg-[#6a35d4] text-white font-bold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Pagar con Wompi — {formatCOP(quote.total)}
              </button>
              {!WOMPI_PUBLIC_KEY && (
                <p className="text-[10px] text-amber-600 text-center">
                  Configura VITE_WOMPI_PUBLIC_KEY en .env
                </p>
              )}
            </div>
          )}

          {/* Step 2 — QR + proof (Nequi / Bre-B) */}
          {isManual && (
            <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-4 space-y-4 animate-in fade-in duration-200">

              {/* QR section */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide self-start">Escanea para pagar</p>

                {/* QR generado en cliente */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
                  <QRCode
                    id="ferry-qr-svg"
                    value={NEQUI_KEY}
                    size={210}
                    bgColor="#ffffff"
                    fgColor="#1e1b4b"
                    level="H"
                  />
                </div>

                {/* Key row */}
                <div className="w-full flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-purple-200">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Llave Nequi / Bre-B</p>
                    <p className="text-base font-bold text-purple-700 tracking-widest">{NEQUI_KEY}</p>
                  </div>
                  <button
                    onClick={handleCopyKey}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      keyCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {keyCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {keyCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                {/* Monto */}
                <div className="w-full flex justify-between items-center bg-white rounded-xl px-3 py-2.5 border border-purple-200">
                  <span className="text-sm text-slate-500">Valor exacto a transferir</span>
                  <span className="font-bold text-slate-800">{formatCOP(quote.total)}</span>
                </div>

                {/* Download QR */}
                <button
                  onClick={handleDownloadQR}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Guardar QR en galería
                </button>
              </div>

              <div className="border-t border-purple-200 pt-3 space-y-3">
                {/* Reference */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Número de referencia (opcional)</label>
                  <input
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    placeholder="Ej: 123456789"
                    className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                  />
                </div>

                {/* Proof upload */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Comprobante de pago *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                  />
                  {proofPreview ? (
                    <div className="mt-1 relative">
                      <img src={proofPreview} alt="Comprobante" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                      <button
                        onClick={() => { setProofFile(null); setProofPreview(null); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 w-full flex flex-col items-center justify-center gap-1.5 py-5 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:border-ferry-400 hover:bg-ferry-50 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-slate-500">Toca para adjuntar el pantallazo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {payError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{payError}</p>
            </div>
          )}

          {/* Submit — solo para métodos manuales; Wompi tiene su propio botón */}
          {isManual && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || processing}
              className="w-full py-3.5 rounded-2xl bg-ferry-600 text-white font-bold text-sm hover:bg-ferry-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando comprobante...</>
                : 'Confirmar pago y enviar comprobante'}
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 pb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] text-slate-400">Tus datos están protegidos · Ferry</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Quote Detail Modal
// ---------------------------------------------------------------------------

const QuoteDetailModal: React.FC<{
  quote: ReceivedQuote;
  alias: string;
  onClose: () => void;
  onProceedToPayment: (quote: ReceivedQuote) => void;
  onCreateSplitOnly: (q: ReceivedQuote) => Promise<void>;
  onAcceptPartialDirect: (q: ReceivedQuote, createSplit: boolean) => void;
}> = ({ quote, alias, onClose, onProceedToPayment, onCreateSplitOnly, onAcceptPartialDirect }) => {
  const isPaid = quote.status === 'paid';
  const availableItems = quote.items.filter(i => i.available);
  const unavailableItems = quote.items.filter(i => !i.available);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {isPaid ? <StoreAvatar name={quote.storeName} /> : <BlindAvatar />}
            <div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">
                {isPaid ? quote.storeName : alias}
              </h3>
              {isPaid && (
                <p className="text-[10px] text-slate-400 mt-0.5">Proveedor confirmado</p>
              )}
              {!isPaid && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {quote.requestCategory && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(quote.requestCategory)}`}>
                      {quote.requestCategory}
                    </span>
                  )}
                  {quote.requestDisplayId && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wide">
                      Ref: {quote.requestDisplayId}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 no-scrollbar">
          {/* Total banner */}
          <div className="bg-ferry-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ferry-600 font-semibold uppercase tracking-wide">Total cotizado</p>
              <p className="text-2xl font-bold text-ferry-700">{formatCOP(quote.total)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">{formatRelativeTime(quote.createdAt)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {availableItems.length}/{quote.items.length} ítems disponibles
              </p>
            </div>
          </div>

          {/* Message */}
          {quote.message && (
            <div className="flex gap-2 bg-slate-50 rounded-xl p-3">
              <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 leading-snug">{quote.message}</p>
            </div>
          )}

          {/* Available items */}
          {availableItems.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Ítems disponibles
              </h4>
              <div className="space-y-2">
                {availableItems.map((item, idx) => (
                  <ItemRow key={idx} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Unavailable items */}
          {unavailableItems.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">
                No disponibles en esta tienda
              </h4>
              <div className="space-y-2 opacity-60">
                {unavailableItems.map((item, idx) => (
                  <ItemRow key={idx} item={item} unavailable />
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 my-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">
                    Esta tienda no tiene disponibilidad de los siguientes artículos en este momento. ¿Deseas generar una solicitud automática para conseguirlos con otro experto local?
                  </p>
                </div>
                <ul className="mt-3">
                  {unavailableItems.map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm font-medium text-amber-900 border-b border-amber-200/50 py-1 last:border-0">
                      <span>{item.name}</span>
                      <span className="text-amber-700 flex-shrink-0 ml-3">{item.quantity} {item.unit}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={async e => {
                      e.preventDefault();
                      e.stopPropagation();
                      try { await onCreateSplitOnly(quote); } finally { onClose(); }
                    }}
                    className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors"
                  >
                    Sí, crear nueva solicitud
                  </button>
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClose();
                      onAcceptPartialDirect(quote, false);
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold text-xs bg-transparent hover:bg-slate-50 transition-colors"
                  >
                    No, aceptar parcial
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {isPaid ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-2xl mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-700">¡Pedido Pagado!</span>
              </div>
              <div className="flex items-center gap-2 bg-ferry-50 border border-ferry-100 rounded-xl px-3 py-2.5 mb-2">
                <Store className="w-4 h-4 text-ferry-600 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-ferry-600 font-semibold uppercase tracking-wide">Proveedor</p>
                  <p className="text-sm font-bold text-slate-800">{quote.storeName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {quote.store?.phoneNumber && (
                  <a
                    href={`https://wa.me/${quote.store.phoneNumber.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(quote.storeName)},%20soy%20el%20contratista%20y%20te%20escribo%20sobre%20mi%20pedido%20en%20Ferry`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.383 0 0 5.383 0 12.031c0 2.115.548 4.175 1.594 5.992L0 24l6.152-1.564c1.748.966 3.708 1.474 5.879 1.474 6.648 0 12.031-5.383 12.031-12.031S18.679 0 12.031 0zm0 22.046c-1.802 0-3.568-.485-5.116-1.404l-.367-.217-3.805.967.98-3.707-.238-.379c-1.009-1.604-1.541-3.463-1.541-5.382 0-5.614 4.568-10.182 10.182-10.182 5.614 0 10.182 4.568 10.182 10.182 0 5.614-4.568 10.182-10.182 10.182zM17.6 15.11c-.305-.153-1.805-.891-2.084-.992-.279-.102-.483-.153-.686.153-.203.305-.788.992-.966 1.196-.178.203-.356.229-.661.076-1.748-.842-3.037-1.83-4.148-3.435-.285-.41.3-.393.889-1.574.076-.153.038-.28-.038-.432-.076-.153-.686-1.654-.94-2.264-.247-.594-.497-.514-.686-.523-.178-.009-.382-.009-.585-.009-.203 0-.534.076-.813.382C6.444 8.04 5.58 8.854 5.58 10.507c0 1.654 1.22 3.257 1.393 3.486.173.23 2.375 3.633 5.753 5.094 2.215.955 3.03.864 4.14.736 1.345-.155 2.871-1.173 3.277-2.308.406-1.135.406-2.107.285-2.311-.122-.204-.428-.328-.733-.481z"/></svg>
                    Contactar
                  </a>
                )}
                <a
                  href="mailto:soporte@ferry.com?subject=Problema%20con%20pedido%20pagado"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Reportar Problema
                </a>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => onProceedToPayment(quote)}
                className="flex-1 py-3 rounded-2xl bg-ferry-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-ferry-700 transition-colors shadow-lg shadow-ferry-200"
              >
                <CreditCard className="w-4 h-4" /> Pagar ahora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ItemRow: React.FC<{ item: QuoteResponseItem; unavailable?: boolean }> = ({ item, unavailable }) => (
  <div className={`flex items-center justify-between bg-white border rounded-xl px-3 py-2.5 ${unavailable ? 'border-red-100' : 'border-slate-100'}`}>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
      {item.nombreComercial && (
        <p className="text-[10px] text-slate-400 truncate">{item.nombreComercial}</p>
      )}
      <p className="text-[10px] text-slate-400 mt-0.5">{item.quantity} {item.unit}</p>
    </div>
    <div className="text-right ml-3 flex-shrink-0">
      {unavailable ? (
        <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Sin stock</span>
      ) : (
        <>
          <p className="text-xs font-bold text-ferry-700">{formatCOP(item.subtotal)}</p>
          <p className="text-[10px] text-slate-400">{formatCOP(item.unitPrice)} c/u</p>
        </>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Partial Accept Modal
// ---------------------------------------------------------------------------

const PartialAcceptModal: React.FC<{
  quote: ReceivedQuote;
  alias: string;
  accepting: boolean;
  onAcceptWithSplit: () => void;
  onAcceptOnly: () => void;
  onCancel: () => void;
}> = ({ quote, alias, accepting, onAcceptWithSplit, onAcceptOnly, onCancel }) => {
  const unavailableItems = quote.items.filter(i => !i.available);
  const count = unavailableItems.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
          ¿Aceptar pedido parcial?
        </h3>

        {/* Message */}
        <p className="text-sm text-slate-500 text-center mb-4 leading-relaxed">
          Faltan{' '}
          <strong className="text-slate-700">
            {count} producto{count !== 1 ? 's' : ''}
          </strong>{' '}
          en esta cotización de <strong className="text-slate-700">{alias}</strong>.
          ¿Deseas aceptar esta orden parcial y crear una nueva solicitud automática solo
          con los artículos faltantes?
        </p>

        {/* Missing items */}
        <div className="bg-slate-50 rounded-xl p-3 mb-5 space-y-1.5">
          {unavailableItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="truncate flex-1">{item.name}</span>
              <span className="text-slate-400 flex-shrink-0">
                {item.quantity} {item.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Primary: accept + create split */}
          <button
            onClick={onAcceptWithSplit}
            disabled={accepting}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {accepting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Sí, crear nueva solicitud
              </>
            )}
          </button>

          {/* Secondary: accept only */}
          <button
            onClick={onAcceptOnly}
            disabled={accepting}
            className="w-full py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm bg-transparent hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            No, aceptar parcial
          </button>

          {/* Ghost: cancel */}
          <button
            onClick={onCancel}
            disabled={accepting}
            className="w-full py-2.5 text-slate-400 font-medium text-sm hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Quote Card (inbox list item)
// ---------------------------------------------------------------------------

const QuoteCard: React.FC<{
  quote: ReceivedQuote;
  alias: string;
  onViewDetail: (q: ReceivedQuote) => void;
  onProceedToPayment: (q: ReceivedQuote) => void;
  onReject: (q: ReceivedQuote) => Promise<void>;
  onCreateSplitOnly: (q: ReceivedQuote) => Promise<void>;
  onAcceptPartialDirect: (q: ReceivedQuote, createSplit: boolean) => void;
  onConfirmDelivery?: (q: ReceivedQuote) => void;
}> = ({ quote, alias, onViewDetail, onProceedToPayment, onReject, onCreateSplitOnly, onAcceptPartialDirect, onConfirmDelivery }) => {
  const [splitHandled, setSplitHandled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const previewItems = quote.items.slice(0, 3);
  const isPaid              = quote.status === 'paid';
  const isPendingValidation = quote.status === 'pending_validation';
  const isPreparing         = quote.status === 'preparing';
  const isShipped           = quote.status === 'shipped';
  const isAccepted          = quote.status === 'accepted';
  const availableCount = quote.items.filter(i => i.available).length;

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onReject(quote);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      isPaid || isShipped ? 'border-green-200'
      : isPreparing       ? 'border-ferry-200'
      : isPendingValidation ? 'border-amber-200'
      : isAccepted        ? 'border-ferry-200'
      : 'border-slate-100'
    }`}>
      {/* Status banner */}
      {isPaid && (
        <div className="bg-green-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Pedido Pagado
        </div>
      )}
      {isPendingValidation && (
        <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Pago en validación — La ferretería revisará tu comprobante
        </div>
      )}
      {isPreparing && (
        <div className="bg-ferry-500 text-white text-xs font-bold text-center py-1.5 px-3">
          <p className="flex items-center justify-center gap-1">
            📦 Alistando tu pedido
          </p>
          <p className="font-normal text-[10px] opacity-90 mt-0.5">
            La ferretería verificó tu pago y está preparando los materiales.
          </p>
        </div>
      )}
      {isShipped && (
        <div className="bg-green-600 text-white text-xs font-bold text-center py-1.5 px-3">
          <p className="flex items-center justify-center gap-1">
            🚚 ¡En camino!
          </p>
          <p className="font-normal text-[10px] opacity-90 mt-0.5">
            Tu pedido ya salió de la tienda y va hacia tu dirección.
          </p>
        </div>
      )}
      {isAccepted && !isPaid && !isPendingValidation && !isPreparing && !isShipped && (
        <div className="bg-ferry-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-1">
          <ThumbsUp className="w-3 h-3" /> Cotización Aceptada — Pendiente de pago
        </div>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {isPaid || isAccepted ? <StoreAvatar name={quote.storeName} /> : <BlindAvatar />}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">
                  {isPaid || isAccepted ? quote.storeName : alias}
                </h3>
                {quote.requestTitle && (
                  <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                    {quote.requestTitle}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {formatRelativeTime(quote.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {quote.requestCategory && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(quote.requestCategory)}`}>
                  {quote.requestCategory}
                </span>
              )}
              {quote.requestDisplayId && (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wide">
                  Ref: {quote.requestDisplayId}
                </span>
              )}
              <span className="text-[10px] text-slate-500 font-medium">
                {availableCount}/{quote.items.length} ítems disponibles
              </span>
            </div>
          </div>
        </div>

        {/* Item preview */}
        <ItemPreview items={quote.items.map(i => ({ name: i.name, quantity: Number(i.quantity), unit: i.unit }))} />

        {/* Total */}
        <div className="mt-1 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-ferry-700">{formatCOP(quote.total)}</p>
              <span className="flex items-center gap-0.5 text-sm text-slate-500">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {quote.distanceKm != null
                  ? quote.distanceKm < 1
                    ? `${(quote.distanceKm * 1000).toFixed(0)} m`
                    : `${quote.distanceKm.toFixed(1)} km`
                  : '—'}
              </span>
            </div>
          </div>
          {quote.message && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <MessageSquare className="w-3 h-3" />
              <span>Mensaje</span>
            </div>
          )}
        </div>

        {/* Missing items notice — hidden once split has been requested */}
        {!splitHandled && quote.items.some(i => !i.available) && quote.status === 'sent' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 my-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Esta tienda no tiene disponibilidad de los siguientes artículos en este momento. ¿Deseas generar una solicitud automática para conseguirlos con otro experto local?
              </p>
            </div>
            <ul className="mt-3">
              {quote.items.filter(i => !i.available).map((item, idx) => (
                <li key={idx} className="flex justify-between text-sm font-medium text-amber-900 border-b border-amber-200/50 py-1 last:border-0">
                  <span>{item.name}</span>
                  <span className="text-amber-700 flex-shrink-0 ml-3">{item.quantity} {item.unit}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 mt-3">
              <button
                onClick={async e => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    await onCreateSplitOnly(quote);
                    setSplitHandled(true);
                  } catch { /* error already shown via actionError toast */ }
                }}
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] transition-colors"
              >
                Sí, crear nueva solicitud
              </button>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAcceptPartialDirect(quote, false);
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold text-[11px] bg-transparent hover:bg-slate-50 transition-colors"
              >
                No, aceptar parcial
              </button>
            </div>
          </div>
        )}

        {/* Collapsed item preview */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-ferry-600 font-semibold mt-2 hover:text-ferry-700 transition-colors"
        >
          <Package className="w-3 h-3" />
          {expanded ? 'Ocultar ítems' : `Ver ${quote.items.length} ítem${quote.items.length !== 1 ? 's' : ''}`}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
            {previewItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400">{item.quantity} {item.unit}</p>
                </div>
                {item.available ? (
                  <p className="text-[11px] font-bold text-ferry-700 flex-shrink-0 ml-2">{formatCOP(item.subtotal)}</p>
                ) : (
                  <span className="text-[10px] text-red-400 font-semibold flex-shrink-0 ml-2">Sin stock</span>
                )}
              </div>
            ))}
            {quote.items.length > 3 && (
              <p className="text-[10px] text-slate-400 text-center">
                +{quote.items.length - 3} ítem{quote.items.length - 3 !== 1 ? 's' : ''} más
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {!isPaid && quote.status === 'sent' && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-400 font-semibold text-xs hover:border-red-200 hover:text-red-400 hover:bg-red-50 disabled:opacity-50 transition-colors"
              title="Rechazar cotización"
            >
              {rejecting ? '...' : 'Rechazar'}
            </button>
            <button
              onClick={() => onViewDetail(quote)}
              className="flex-1 py-2.5 rounded-xl border border-ferry-200 text-ferry-700 font-semibold text-xs hover:bg-ferry-50 transition-colors"
            >
              Ver Detalle
            </button>
            <button
              onClick={() => onProceedToPayment(quote)}
              className="flex-1 py-2.5 rounded-xl bg-ferry-600 text-white font-bold text-xs flex items-center justify-center gap-1 hover:bg-ferry-700 transition-colors shadow-md shadow-ferry-100"
            >
              <CreditCard className="w-3.5 h-3.5" /> Pagar
            </button>
          </div>
        )}
        {/* Accepted but not paid — show pay button */}
        {isAccepted && !isPaid && !isPendingValidation && (
          <div className="mt-4">
            <button
              onClick={() => onProceedToPayment(quote)}
              className="w-full py-2.5 rounded-xl bg-ferry-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-ferry-700 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" /> Completar pago
            </button>
          </div>
        )}

        {/* Shipped — confirm delivery */}
        {isShipped && onConfirmDelivery && (
          <div className="mt-4">
            <button
              onClick={() => onConfirmDelivery(quote)}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-green-100"
            >
              <PackageCheck className="w-4 h-4" /> Confirmar entrega
            </button>
          </div>
        )}

        {/* Delivered — show review stars */}
        {quote.status === 'delivered' && quote.review && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
            {quote.review.rating > 0 ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className={`w-4 h-4 ${n <= quote.review!.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'}`}
                  />
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-wider">
                ✔️ Entrega confirmada sin calificar
              </span>
            )}
            {quote.review.comment && (
              <span className="text-xs text-slate-500 italic ml-1">"{quote.review.comment}"</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Request Card (Enviadas tab)
// ---------------------------------------------------------------------------

const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  pending:          { label: 'Buscando expertos...',     color: 'text-amber-600 bg-amber-50' },
  searching:        { label: 'Buscando expertos...',     color: 'text-amber-600 bg-amber-50' },
  cotizando:        { label: 'Recibiendo cotizaciones',  color: 'text-blue-600 bg-blue-50' },
  accepted:         { label: 'Aceptada',                 color: 'text-green-600 bg-green-50' },
  accepted_partial: { label: 'Aceptada parcialmente',    color: 'text-orange-600 bg-orange-50' },
  paid:             { label: 'Pagada',                   color: 'text-green-700 bg-green-100' },
};

// Compact item preview strip — shared by RequestCard and QuoteCard
const ItemPreview: React.FC<{ items: Array<{ name: string; quantity: number; unit?: string }> }> = ({ items }) => {
  if (items.length === 0) return null;
  const preview = items.slice(0, 2);
  const remaining = items.length - 2;
  return (
    <div className="mt-2 mb-1 p-2 bg-gray-50 rounded-lg border border-gray-100">
      {preview.map((item, i) => (
        <p key={i} className="text-sm text-gray-700 truncate leading-snug">
          <span className="font-semibold">{item.quantity}x</span> {item.name}
        </p>
      ))}
      {remaining > 0 && (
        <p className="text-xs text-orange-500 font-medium mt-1">+ {remaining} producto{remaining !== 1 ? 's' : ''} más</p>
      )}
    </div>
  );
};

const RequestCard: React.FC<{ request: UserOwnRequest }> = ({ request }) => {
  const statusInfo = REQUEST_STATUS[request.status] ?? { label: request.status, color: 'text-slate-500 bg-slate-50' };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-ferry-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-ferry-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-800 text-sm leading-tight truncate flex-1">{request.title}</h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wide flex-shrink-0">
              {request.displayId}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {request.category && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(request.category)}`}>
                {request.category}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <ItemPreview items={request.items} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Package className="w-3 h-3" />
              {request.itemCount} artículo{request.itemCount !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatRelativeTime(request.createdAt)}
            </span>
          </div>
          {request.isExpandedSearch && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ferry-600">
              <Search className="w-3 h-3" />
              <span>Búsqueda extendida activa</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export const UserQuotesInbox: React.FC<{ initialTab?: 'enviadas' | 'recibidas' | 'en-camino' | 'entregadas' }> = ({ initialTab = 'enviadas' }) => {
  const [activeTab, setActiveTab] = useState<'enviadas' | 'recibidas' | 'en-camino' | 'entregadas'>(initialTab);
  const [quotes, setQuotes] = useState<ReceivedQuote[]>([]);
  const [ownRequests, setOwnRequests] = useState<UserOwnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailQuote, setDetailQuote] = useState<ReceivedQuote | null>(null);
  const [checkoutQuote, setCheckoutQuote] = useState<ReceivedQuote | null>(null);
  const [splitToast, setSplitToast] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newQuoteToast, setNewQuoteToast] = useState<string | null>(null);
  const [wompiPaidToast, setWompiPaidToast]       = useState(false);
  const [reviewQuote, setReviewQuote]             = useState<ReceivedQuote | null>(null);
  const [partialAcceptQuote, setPartialAcceptQuote] = useState<ReceivedQuote | null>(null);
  const [partialAccepting, setPartialAccepting] = useState(false);
  const unsubRef = React.useRef<() => void>(() => {});
  const subscribedRef = React.useRef(false);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [quotesResult, requestsResult] = await Promise.all([
        getUserReceivedQuotes(),
        getUserOwnRequests(),
      ]);
      setQuotes(quotesResult);
      setOwnRequests(requestsResult);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // ── Wompi redirect result ────────────────────────────────────────────────
  // Runs once on mount: reads ?id=&status=&reference=... left by Wompi redirect
  useEffect(() => {
    checkWompiRedirect().then(result => {
      if (!result) return;
      if (result.status === 'APPROVED') {
        // Update Firestore if we have the context
        if (result.ctx) {
          verifyWompiPayment(result.ctx.quoteId, result.transactionId!)
            .then(() => {
              setQuotes(prev => prev.map(q =>
                q.id === result.ctx!.quoteId ? { ...q, status: 'paid' } : q
              ));
              // Show success toast ONLY on success
              setWompiPaidToast(true);
              setTimeout(() => setWompiPaidToast(false), 6000);
            })
            .catch(err => {
              console.error('[Ferry/Wompi] verifyWompiPayment falló:', err);
              alert('Error al verificar el pago. Intenta de nuevo.');
            });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling para nuevas cotizaciones (reemplaza subscribeToNewQuotes de Firebase)
  useEffect(() => {
    if (loading || subscribedRef.current || quotes.length === 0) return;
    subscribedRef.current = true;

    const interval = setInterval(() => {
      loadQuotes();
    }, 15000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Opens the checkout modal, intercepting partial quotes first
  const handleOpenCheckout = (quote: ReceivedQuote) => {
    const unavailableCount = quote.items.filter(i => !i.available).length;
    if (unavailableCount > 0 && quote.status === 'sent') {
      setDetailQuote(null);
      setPartialAcceptQuote(quote);
      return;
    }
    setDetailQuote(null);
    setCheckoutQuote(quote);
  };

  // Creates the split request ONLY — does NOT open the payment modal.
  // Used by the inline amber card "Sí, crear nueva solicitud" button.
  const handleCreateSplitOnly = async (quoteToAccept: ReceivedQuote): Promise<void> => {
    setPartialAccepting(true);
    try {
      const result = await acceptQuote(quoteToAccept.id, quoteToAccept.requestId, true);
      const acceptedId = quoteToAccept.id;
      const reqId = quoteToAccept.requestId;
      setQuotes(prev =>
        prev.map(q => {
          if (q.id === acceptedId) return { ...q, status: 'accepted_partial' };
          if (q.requestId === reqId && q.id !== acceptedId) return { ...q, status: 'rejected' };
          return q;
        }),
      );
      if (result.splitCreated) {
        setSplitToast(true);
        setTimeout(() => setSplitToast(false), 5000);
      }
      setDetailQuote(null);
      setPartialAcceptQuote(null);
    } catch (e: any) {
      console.error('Error en Split Order:', e);
      setActionError('No se pudo procesar. Intenta de nuevo.');
      setTimeout(() => setActionError(null), 3500);
      throw e;
    } finally {
      setPartialAccepting(false);
    }
  };

  // Handles the user's decision in PartialAcceptModal (or inline action)
  const handlePartialAccept = async (quoteToAccept: ReceivedQuote, createSplit: boolean) => {
    setPartialAccepting(true);
    try {
      const result = await acceptQuote(
        quoteToAccept.id,
        quoteToAccept.requestId,
        createSplit
      );
      // Update local state optimistically
      const acceptedId = quoteToAccept.id;
      const reqId = quoteToAccept.requestId;
      setQuotes(prev =>
        prev.map(q => {
          if (q.id === acceptedId) return { ...q, status: 'accepted_partial' };
          if (q.requestId === reqId && q.id !== acceptedId) return { ...q, status: 'rejected' };
          return q;
        }),
      );
      if (result.splitCreated) {
        setSplitToast(true);
        setTimeout(() => setSplitToast(false), 5000);
      }
      // Proceed to payment with updated quote
      const quoteForPayment = { ...quoteToAccept, status: 'accepted_partial' };
      setDetailQuote(null);
      setPartialAcceptQuote(null);
      setCheckoutQuote(quoteForPayment);
    } catch (e: any) {
      console.error('Error exacto en Split Order:', e);
      setActionError('No se pudo procesar. Intenta de nuevo.');
      setTimeout(() => setActionError(null), 3500);
    } finally {
      setPartialAccepting(false);
    }
  };

  // Called by PaymentCheckoutModal on APPROVED transaction
  const handlePaymentSuccess = async (quote: ReceivedQuote): Promise<AcceptQuoteResult> => {
    let result: AcceptQuoteResult = { splitCreated: false };
    // Skip acceptQuote if already accepted_partial (split already handled in modal)
    if (quote.status !== 'accepted' && quote.status !== 'accepted_partial') {
      result = await acceptQuote(quote.id, quote.requestId);
    }
    // No llamamos a verifyWompiPayment aquí porque onPaymentSuccess de Wompi 
    // usa un redirect. Si esto es para Manual, ya cambió de estado.
    setQuotes(prev =>
      prev.map(q => {
        if (q.id === quote.id) return { ...q, status: 'paid' };
        if (q.requestId === quote.requestId && q.status !== 'rejected') {
          return { ...q, status: 'rejected' };
        }
        return q;
      }),
    );
    if (result.splitCreated) {
      setSplitToast(true);
      setTimeout(() => setSplitToast(false), 5000);
    }
    return result;
  };

  const handleCheckoutClose = () => {
    setCheckoutQuote(null);
  };

  const handleConfirmDeliverySubmit = useCallback(async (
    quoteId: string, requestId: string, rating: number, comment: string,
  ) => {
    await confirmDelivery(quoteId, requestId, { rating, comment });
    setQuotes(prev => prev.map(q =>
      q.id === quoteId
        ? { ...q, status: 'delivered', review: { rating, comment, createdAt: null } }
        : q
    ));
    setReviewQuote(null);
  }, []);

  const handleManualPaymentSuccess = useCallback(async (quoteId: string) => {
    setQuotes(prev => prev.map(q =>
      q.id === quoteId ? { ...q, status: 'pending_validation' } : q
    ));
    setCheckoutQuote(null);
    setWompiPaidToast(true); // reuse same toast
    setTimeout(() => setWompiPaidToast(false), 6000);
    await loadQuotes(); // Refetch to get unblinded store info
  }, [loadQuotes]);

  const handleWompiApproved = useCallback((transactionId: string) => {
    const q = checkoutQuote;
    if (q) {
      verifyWompiPayment(q.id, transactionId)
        .then(async () => {
          setQuotes(prev => prev.map(item =>
            item.id === q.id ? { ...item, status: 'paid' } : item
          ));
          setWompiPaidToast(true);
          setTimeout(() => setWompiPaidToast(false), 6000);
          await loadQuotes(); // Refetch to get unblinded store info
        })
        .catch((err: unknown) => {
          console.error('[Ferry/Wompi] verifyWompiPayment falló:', err);
          alert('Error al verificar el pago con el servidor. Intenta de nuevo.');
        });
    }
  }, [checkoutQuote, loadQuotes]);

  const handleReject = async (quote: ReceivedQuote) => {
    // Optimistic: remove immediately
    setQuotes(prev => prev.filter(q => q.id !== quote.id));
    try {
      await rejectQuote(quote.id, quote.requestId);
    } catch (e: any) {
      console.error('Detalle del error en Firebase:', e?.code, e?.message, e);
      setQuotes(prev => [...prev, quote]);
      setActionError('No se pudo rechazar. Intenta de nuevo.');
      setTimeout(() => setActionError(null), 3500);
    }
  };

  // ── Lifecycle buckets ────────────────────────────────────────────────────
  const enviadasItems  = ownRequests.filter(r => ['pending', 'searching', 'cotizando'].includes(r.status));
  const recibidasQuotes = quotes.filter(q => ['sent', 'accepted', 'accepted_partial'].includes(q.status));
  const enCaminoQuotes  = quotes.filter(q => ['paid', 'processing', 'shipped', 'pending_validation', 'preparing'].includes(q.status));
  const entregadasQuotes = quotes.filter(q => ['delivered', 'completed', 'DELIVERED'].includes(q.status));

  // ── Alias map: quoteId → "Experto Local #N" ─────────────────────────────
  const quoteAliases: Record<string, string> = (() => {
    const byRequest: Record<string, ReceivedQuote[]> = {};
    quotes.forEach(q => {
      (byRequest[q.requestId] ??= []).push(q);
    });
    const map: Record<string, string> = {};
    Object.values(byRequest).forEach(group => {
      const sorted = [...group].sort(
        (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      );
      sorted.forEach((q, i) => { map[q.id] = `Experto Local #${i + 1}`; });
    });
    return map;
  })();

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ferry-100 rounded-xl flex items-center justify-center">
            <Inbox className="w-4 h-4 text-ferry-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">Mis Cotizaciones</h2>
            {!loading && (
              <p className="text-[10px] text-slate-400">
                {recibidasQuotes.length} pendiente{recibidasQuotes.length !== 1 ? 's' : ''}
                {enCaminoQuotes.length > 0 && ` · ${enCaminoQuotes.length} en camino`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={loadQuotes}
          disabled={loading}
          className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tab bar — horizontally scrollable, underline style */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-gray-200 pb-0 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: 'enviadas',    label: 'Enviadas',    count: enviadasItems.length },
            { key: 'recibidas',   label: 'Recibidas',   count: recibidasQuotes.length },
            { key: 'en-camino',   label: 'En camino',   count: enCaminoQuotes.length },
            { key: 'entregadas',  label: 'Entregadas',  count: entregadasQuotes.length },
          ] as const
        ).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'text-orange-600 font-bold border-orange-500'
                : 'text-gray-500 font-medium border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-full bg-ferry-50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-ferry-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-500">Buscando cotizaciones...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">No se pudo cargar</p>
            <p className="text-xs text-red-500">{error}</p>
          </div>
          <button onClick={loadQuotes} className="text-xs font-bold text-red-600 hover:text-red-700">
            Reintentar
          </button>
        </div>
      )}

      {/* ── ENVIADAS ─────────────────────────────────────────────────────── */}
      {activeTab === 'enviadas' && !loading && !error && (
        enviadasItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-orange-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-2">Sin solicitudes activas</h3>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              Cuando envíes un listado de materiales, aparecerá aquí mientras buscamos expertos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enviadasItems.map(r => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        )
      )}

      {/* ── RECIBIDAS ────────────────────────────────────────────────────── */}
      {activeTab === 'recibidas' && !loading && !error && (
        recibidasQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 bg-ferry-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-10 h-10 text-ferry-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-2">Sin cotizaciones pendientes</h3>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              Las cotizaciones de los expertos aparecerán aquí cuando estén listas para que las revises.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recibidasQuotes.map(q => (
              <QuoteCard
                key={q.id}
                quote={q}
                alias={quoteAliases[q.id] ?? 'Experto Local'}
                onViewDetail={setDetailQuote}
                onProceedToPayment={handleOpenCheckout}
                onReject={handleReject}
                onCreateSplitOnly={handleCreateSplitOnly}
                onAcceptPartialDirect={handlePartialAccept}
              />
            ))}
          </div>
        )
      )}

      {/* ── EN CAMINO ────────────────────────────────────────────────────── */}
      {activeTab === 'en-camino' && !loading && !error && (
        enCaminoQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Truck className="w-10 h-10 text-blue-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-2">Nada en camino aún</h3>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              Los pedidos que hayas pagado y estén en tránsito aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                En tránsito ({enCaminoQuotes.length})
              </h3>
            </div>
            {enCaminoQuotes.map(q => (
              <QuoteCard
                key={q.id}
                quote={q}
                alias={quoteAliases[q.id] ?? 'Experto Local'}
                onViewDetail={setDetailQuote}
                onProceedToPayment={handleOpenCheckout}
                onReject={handleReject}
                onCreateSplitOnly={handleCreateSplitOnly}
                onAcceptPartialDirect={handlePartialAccept}
                onConfirmDelivery={setReviewQuote}
              />
            ))}
          </div>
        )
      )}

      {/* ── ENTREGADAS ───────────────────────────────────────────────────── */}
      {activeTab === 'entregadas' && !loading && !error && (
        entregadasQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <PackageCheck className="w-10 h-10 text-green-300" />
            </div>
            <h3 className="font-bold text-slate-700 mb-2">Sin entregas completadas</h3>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              Aquí verás el historial de pedidos que ya fueron entregados exitosamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <PackageCheck className="w-3.5 h-3.5 text-green-600" />
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide">
                Entregados ({entregadasQuotes.length})
              </h3>
            </div>
            {entregadasQuotes.map(q => (
              <QuoteCard
                key={q.id}
                quote={q}
                alias={quoteAliases[q.id] ?? 'Experto Local'}
                onViewDetail={setDetailQuote}
                onProceedToPayment={handleOpenCheckout}
                onReject={handleReject}
                onCreateSplitOnly={handleCreateSplitOnly}
                onAcceptPartialDirect={handlePartialAccept}
              />
            ))}
          </div>
        )
      )}

      {/* Review / delivery confirmation modal */}
      {reviewQuote && (
        <ReviewModal
          quote={reviewQuote}
          onClose={() => setReviewQuote(null)}
          onSubmit={handleConfirmDeliverySubmit}
        />
      )}

      {/* Detail modal */}
      {detailQuote && (
        <QuoteDetailModal
          quote={detailQuote}
          alias={quoteAliases[detailQuote.id] ?? 'Experto Local'}
          onClose={() => setDetailQuote(null)}
          onProceedToPayment={handleOpenCheckout}
          onCreateSplitOnly={handleCreateSplitOnly}
          onAcceptPartialDirect={handlePartialAccept}
        />
      )}

      {/* Checkout / payment modal */}
      {checkoutQuote && (
        <PaymentCheckoutModal
          quote={checkoutQuote}
          alias={quoteAliases[checkoutQuote.id] ?? 'Experto Local'}
          onClose={handleCheckoutClose}
          onPaymentSuccess={handlePaymentSuccess}
          onWompiApproved={handleWompiApproved}
          onManualPaymentSuccess={handleManualPaymentSuccess}
        />
      )}

      {/* Wompi payment success toast */}
      {wompiPaidToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white border-l-4 border-green-500 shadow-xl rounded-2xl px-4 py-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300 max-w-[360px] w-[calc(100%-2rem)]">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800 leading-snug mb-0.5">¡Pago confirmado!</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              La ferretería ya recibió tu orden y está alistando los materiales. Pronto se realizará el despacho.
            </p>
          </div>
          <button onClick={() => setWompiPaidToast(false)} className="shrink-0 text-slate-300 hover:text-slate-500 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New quote notification toast */}
      {newQuoteToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white border-l-4 border-orange-500 shadow-md rounded-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300 max-w-[340px] w-[calc(100%-2rem)]">
          <Bell className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700 leading-snug">
            ¡Ferry Notificaciones! La cotización del listado{' '}
            <span className="font-bold text-slate-900">{newQuoteToast}</span>{' '}
            ya se hizo.
          </p>
        </div>
      )}

      {/* Partial acceptance modal */}
      {partialAcceptQuote && (
        <PartialAcceptModal
          quote={partialAcceptQuote}
          alias={quoteAliases[partialAcceptQuote.id] ?? 'Experto Local'}
          accepting={partialAccepting}
          onAcceptWithSplit={() => handlePartialAccept(partialAcceptQuote!, true)}
          onAcceptOnly={() => handlePartialAccept(partialAcceptQuote!, false)}
          onCancel={() => setPartialAcceptQuote(null)}
        />
      )}

      {/* Action error toast (reject failed) */}
      {actionError && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Split request toast */}
      {splitToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ferry-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 max-w-[340px] text-center">
          <Package className="w-4 h-4 flex-shrink-0" />
          Buscando otra tienda para los artículos que faltaron.
        </div>
      )}
    </div>
  );
};
