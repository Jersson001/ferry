
import React, { useState, useEffect } from 'react';
import { MaterialRequest, RequestStatus, UserProfile } from '../types';
import { Package, Clock, Truck, CheckCircle2, Store, AlertCircle, X, Inbox, RefreshCw, FileText, MapPin, Send, Trash2, RotateCcw, Eye } from 'lucide-react';
import { getPendingRequestsForStore, formatRelativeTime, IncomingQuoteRequest, submitQuoteResponse, getStorePriceCatalog, saveStorePriceCatalog, StoreCatalogEntry, rejectQuoteRequest, updateQuoteLogisticStatus, getStoreSentQuotes, StoreSentQuote, FERRY_MARKUP } from '../services/quoteService';
import { getStoreCatalogProducts } from '../services/catalogService';
import { useApi } from '../hooks/useApi';

interface Props {
  requests: MaterialRequest[];
  profile: UserProfile | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// QuoteResponseModal — store fills prices and sends the quote to the user
// ─────────────────────────────────────────────────────────────────────────────
interface QuoteResponseModalProps {
  req: IncomingQuoteRequest;
  storeName: string;
  storeId: string;
  onClose: () => void;
  onSuccess: (reqId: string) => void;
}

// FERRY_MARKUP importado desde quoteService — fuente de verdad única

const buildItemDisplayName = (item: { name: string }): string => {
  return (item.name || '').replace(/\s*\(falta[^)]*\)/gi, '').trim();
};

const QuoteResponseModal: React.FC<QuoteResponseModalProps> = ({ req, storeName, storeId, onClose, onSuccess }) => {
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [skus, setSkus] = useState<Record<number, string>>({});
  const [discarded, setDiscarded] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleDiscard = (idx: number) =>
    setDiscarded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  // ── Pre-fill prices & SKUs from store's price memory ──────────────────────
  useEffect(() => {
    getStorePriceCatalog().then(catalog => {
      const newPrices: Record<number, string> = {};
      const newSkus: Record<number, string> = {};
      req.items.forEach((item, idx) => {
        const entry = catalog[item.name.toLowerCase().trim()];
        if (entry) {
          if (entry.price > 0) newPrices[idx] = String(entry.price);
          if (entry.sku) newSkus[idx] = entry.sku;
        }
      });
      if (Object.keys(newPrices).length > 0) setPrices(newPrices);
      if (Object.keys(newSkus).length > 0) setSkus(newSkus);
    }).catch(() => {}); // silently ignore network errors
  }, [req.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SKU → price lookup from store's Firestore catalog
  const [skuMap, setSkuMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!storeId) return;
    getStoreCatalogProducts(storeId).then(items => {
      const map: Record<string, number> = {};
      items.forEach(i => { if (i.sku) map[i.sku.toUpperCase()] = i.price; });
      setSkuMap(map);
    }).catch(() => {});
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Commercial conditions
  const [applyTax, setApplyTax] = useState(true);   // Regla 2: IVA siempre activo
  const [taxRate, setTaxRate] = useState('19');
  const [discount, setDiscount] = useState('');
  const [transportCost, setTransportCost] = useState(''); // Regla 3: siempre visible

  const getParsedQty = (qty: string) => Math.max(parseFloat(qty) || 1, 0.001);

  const getItemSubtotal = (idx: number): number => {
    const unitPrice = parseFloat(prices[idx] ?? '0') || 0;
    const qty = getParsedQty(req.items[idx]?.quantity ?? '1');
    return unitPrice * qty;
  };

  const subtotalBruto = req.items.reduce((sum, _, idx) =>
    discarded.has(idx) ? sum : sum + getItemSubtotal(idx), 0);
  const parsedDiscount = Math.max(parseFloat(discount || '0') || 0, 0);
  const subtotalNeto = Math.max(subtotalBruto - parsedDiscount, 0);
  const parsedTaxRate = Math.max(parseFloat(taxRate || '0') || 0, 0);
  const taxAmount = applyTax ? Math.round(subtotalNeto * parsedTaxRate / 100) : 0;
  // Regla 3: $0 = envío gratis (tienda cubre), >0 = suma al total
  const parsedTransportCost = Math.max(parseFloat(transportCost || '0') || 0, 0);
  // Total que ve la tienda = su costo_con_iva + envío
  const total = subtotalNeto + taxAmount + parsedTransportCost;
  const quotedCount = req.items.filter((_, idx) =>
    !discarded.has(idx) && (parseFloat(prices[idx] ?? '0') || 0) > 0).length;
  const hasAtLeastOnePrice = quotedCount > 0;

  const handleSubmit = async () => {
    if (!hasAtLeastOnePrice || subtotalBruto === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // ── Ítems con precios BASE de la tienda (sin markup) ─────────────────
      // El markup del 14% se aplica en submitQuoteResponse (capa de servicio).
      // Este componente NUNCA calcula precios de cliente.
      const ivaMult = applyTax ? (1 + parsedTaxRate / 100) : 1;
      const storeItems = req.items.map((item, idx) => {
        const isDiscarded = discarded.has(idx);
        const unitPriceBase = isDiscarded ? 0 : (parseFloat(prices[idx] || '0') || 0);
        // Precio con IVA baked-in (sin markup Ferry — eso lo hace el servicio)
        const unitPrice = !isDiscarded && unitPriceBase > 0
          ? Math.round(unitPriceBase * ivaMult)
          : 0;
        const qty       = Math.max(parseFloat(item.quantity ?? '1') || 1, 0.001);
        const subtotal  = Math.round(unitPrice * qty);
        return {
          name:           item.name,
          nombreComercial: item.nombreComercial,
          quantity:       qty,
          unit:           item.unit,
          storeBaseUnitPrice: unitPrice,       // precio tienda con IVA, sin markup
          subtotal,
          available:      !isDiscarded && unitPriceBase > 0,
          sku:            isDiscarded ? null : (skus[idx]?.trim() || null),
        };
      });

      // ── Totales de la tienda (sin markup Ferry) ───────────────────────────
      const storeSubtotalBruto = storeItems.reduce((s, i) => s + i.subtotal, 0);
      const storeSubtotalNeto  = Math.max(storeSubtotalBruto - parsedDiscount, 0);
      const storeTotal         = storeSubtotalNeto + parsedTransportCost;

      // ── Guardar memoria de precios (best-effort) ──────────────────────────
      saveStorePriceCatalog(
        storeItems
          .filter(i => i.available)
          // Guardamos el precio SIN IVA para que al pre-rellenar sea comparable
          .map(i => ({ name: i.name, price: parseFloat(prices[storeItems.indexOf(i)] ?? '0') || 0, sku: i.sku }))
      ).catch(() => {}); // fire-and-forget

      // ── Enviar al servicio — el markup lo aplica submitQuoteResponse ──────
      await submitQuoteResponse({
        requestId:        req.id,
        storeName,
        items:            storeItems,
        storeSubtotalBruto,
        discount:         parsedDiscount,
        storeSubtotalNeto,
        taxRate:          applyTax ? parsedTaxRate : 0,
        taxAmount:        applyTax ? Math.round(storeSubtotalNeto * parsedTaxRate / 100) : 0,
        transportCost:    parsedTransportCost,
        storeTotal,
        distanceKm:       req.distanceKm,
        message,
      });
      onSuccess(req.id);
    } catch {
      setSubmitError('No se pudo enviar la cotización. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg leading-tight">Enviar Cotización</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-bold bg-ferry-50 text-ferry-700 border border-ferry-100 px-2 py-0.5 rounded-full">
                {req.category}
              </span>
              {req.distanceKm !== undefined && (
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {req.distanceKm < 1
                    ? `${(req.distanceKm * 1000).toFixed(0)} m`
                    : `${req.distanceKm.toFixed(1)} km`}
                </span>
              )}
              <span className="text-[10px] text-slate-400">{formatRelativeTime(req.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full flex-shrink-0 ml-2 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Instruction */}
          <p className="text-xs text-slate-400 px-0.5">
            Ingresa tu precio unitario por cada artículo. Deja en <span className="font-semibold">0</span> los que no tienes en stock.
          </p>

          {/* Item rows */}
          {req.items.map((item, idx) => {
            const isDiscarded = discarded.has(idx);
            const unitPrice = parseFloat(prices[idx] ?? '0') || 0;
            const itemSubtotal = getItemSubtotal(idx);
            const hasPrice = !isDiscarded && unitPrice > 0;

            return (
              <div
                key={idx}
                className={`rounded-2xl border p-3.5 transition-all duration-200 ${
                  isDiscarded
                    ? 'border-red-200 bg-red-50/60 opacity-75'
                    : hasPrice
                      ? 'border-ferry-200 bg-ferry-50/60'
                      : 'border-slate-100 bg-slate-50'
                }`}
              >
                {/* Item name + quantity badge + discard button */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className={`text-sm font-bold leading-snug whitespace-normal break-words uppercase flex-1 min-w-0 ${
                    isDiscarded ? 'line-through text-slate-400' : 'text-slate-800'
                  }`}>
                    {buildItemDisplayName(item)}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isDiscarded && (
                      <span className="bg-amber-100 text-amber-800 font-extrabold px-3 py-1 rounded-lg text-base leading-none whitespace-nowrap border border-amber-200">
                        × {item.quantity} {item.unit}
                      </span>
                    )}
                    {isDiscarded && (
                      <span className="bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-lg text-xs leading-none whitespace-nowrap border border-red-200">
                        No disponible
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleDiscard(idx)}
                      title={isDiscarded ? 'Restaurar artículo' : 'Marcar como no disponible'}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isDiscarded
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-500'
                          : 'bg-red-100 hover:bg-red-200 text-red-500'
                      }`}
                    >
                      {isDiscarded
                        ? <RotateCcw className="w-3.5 h-3.5" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* SKU + Price inputs (hidden when discarded) */}
                {!isDiscarded && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="SKU / Ref"
                      value={skus[idx] ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        setSkus(prev => ({ ...prev, [idx]: val }));
                        // Regla 1: auto-fill precio desde catálogo por SKU
                        const found = skuMap[val.toUpperCase().trim()];
                        if (found) setPrices(prev => ({ ...prev, [idx]: String(found) }));
                      }}
                      className="w-0 flex-[2] min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition-shadow"
                    />
                    <div className="relative flex-[3] min-w-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                        value={prices[idx] ?? ''}
                        onChange={e => setPrices(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-right outline-none focus:ring-2 focus:ring-ferry-500 focus:border-ferry-400 transition-shadow"
                      />
                    </div>
                    {hasPrice && (
                      <span className="text-xs font-bold text-ferry-700 bg-ferry-100 px-2 py-1.5 rounded-xl whitespace-nowrap flex-shrink-0 border border-ferry-200">
                        ${itemSubtotal.toLocaleString('es-CO')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Condiciones Comerciales ── */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Condiciones Comerciales</p>

            {/* Descuento */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-700 font-medium flex-1">Descuento</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="w-32 pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-right outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-shadow"
                />
              </div>
            </div>

            {/* IVA toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setApplyTax(v => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${applyTax ? 'bg-ferry-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${applyTax ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-slate-700 font-medium flex-1">¿Aplicar IVA?</span>
              {applyTax && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-center outline-none focus:ring-2 focus:ring-ferry-500 focus:border-ferry-400 transition-shadow"
                  />
                  <span className="text-sm text-slate-400 font-medium">%</span>
                </div>
              )}
            </div>

            {/* Costo de Envío — Regla 3: siempre visible, $0 = gratis */}
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700 font-medium flex-1">Costo de Envío</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={transportCost}
                  onChange={e => setTransportCost(e.target.value)}
                  className="w-32 pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-right outline-none focus:ring-2 focus:ring-ferry-500 focus:border-ferry-400 transition-shadow"
                />
              </div>
            </div>
            {parsedTransportCost === 0 && (
              <p className="text-[10px] text-emerald-600 font-semibold pl-7">
                ✓ Envío Gratis — la tienda cubre el flete
              </p>
            )}
          </div>

          {/* Regla 4: Dirección de entrega — justo encima del totalizador */}
          {req.deliveryAddress && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Dirección de entrega</p>
                <p className="text-xs text-amber-900 font-medium leading-snug mt-0.5">{req.deliveryAddress}</p>
              </div>
            </div>
          )}

          {/* ── Total card con desglose ── */}
          <div className="rounded-2xl bg-slate-900 text-white px-5 py-4 space-y-2">
            {/* Subtotal bruto */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-semibold">${subtotalBruto.toLocaleString('es-CO')}</span>
            </div>
            {/* Descuento */}
            {parsedDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Descuento</span>
                <span className="font-semibold text-emerald-400">− ${parsedDiscount.toLocaleString('es-CO')}</span>
              </div>
            )}
            {/* Subtotal neto (solo si hay descuento) */}
            {parsedDiscount > 0 && (
              <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">Subtotal neto</span>
                <span className="font-semibold">${subtotalNeto.toLocaleString('es-CO')}</span>
              </div>
            )}
            {/* IVA */}
            {applyTax && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">IVA ({parsedTaxRate}%)</span>
                <span className="font-semibold">+ ${taxAmount.toLocaleString('es-CO')}</span>
              </div>
            )}
            {/* Envío */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Envío</span>
              <span className={`font-semibold ${parsedTransportCost === 0 ? 'text-emerald-400' : ''}`}>
                {parsedTransportCost === 0
                  ? 'Gratis'
                  : `+ $${parsedTransportCost.toLocaleString('es-CO')}`}
              </span>
            </div>
            {/* Total final */}
            <div className="border-t border-slate-700 pt-2 flex items-end justify-between">
              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">Total a pagar</p>
                <p className="text-2xl font-black tracking-tight">${total.toLocaleString('es-CO')}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-ferry-400">{quotedCount}<span className="text-slate-500 font-normal text-sm">/{req.items.length}</span></p>
                <p className="text-[10px] text-slate-500">ítems cotizados</p>
              </div>
            </div>
          </div>

          {/* Message textarea */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Mensaje al cliente{' '}
              <span className="font-normal normal-case text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Ej: Tengo todo en stock, puedo entregar hoy mismo. El flete es gratis dentro de la ciudad."
              className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-500 resize-none h-24 placeholder:text-slate-400"
            />
          </div>

          {/* Inline error */}
          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}
        </div>

        {/* ── Footer / Submit ── */}
        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={!hasAtLeastOnePrice || subtotalBruto === 0 || isSubmitting}
            className="w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
              disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none
              bg-ferry-600 hover:bg-ferry-700 text-white shadow-lg shadow-ferry-200/60"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando cotización...
              </>
            ) : subtotalBruto > 0 ? (
              <>
                <Send className="w-4 h-4" />
                Enviar Cotización · ${total.toLocaleString('es-CO')}
              </>
            ) : (
              'Ingresa precios para cotizar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const StorePanel: React.FC<Props> = ({ requests, profile }) => {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'QUOTES' | 'ORDERS'>('INBOX');

  // --- INBOX STATE ---
  const [inboxRequests, setInboxRequests] = useState<IncomingQuoteRequest[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  // Which request the store is currently quoting (opens QuoteResponseModal)
  const [quotingInboxRequest, setQuotingInboxRequest] = useState<IncomingQuoteRequest | null>(null);
  // Success toast shown after a quote is sent
  const [quoteToastSuccess, setQuoteToastSuccess] = useState(false);
  // Requests rejected by this store (hidden from list, client-side only)
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  // Reject confirmation dialog
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  // Rejected toast
  const [rejectToastVisible, setRejectToastVisible] = useState(false);
  // Manual override of estimated cost per request (empty = show auto-computed value)
  const [estimatedCosts, setEstimatedCosts] = useState<Record<string, string>>({});
  // Store's own price catalog (loaded alongside inbox)
  const [storeCatalog, setStoreCatalog] = useState<Record<string, StoreCatalogEntry>>({});

  // --- ENVIADAS (QUOTES) STATE ---
  const [sentQuotes, setSentQuotes] = useState<StoreSentQuote[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  const loadSentQuotes = async () => {
    setLoadingSent(true);
    try {
      const data = await getStoreSentQuotes();
      setSentQuotes(data);
    } catch (e: any) {
      console.error('[Ferry/loadSentQuotes]', e?.code, e?.message);
    } finally {
      setLoadingSent(false);
    }
  };

  const storeCategory = profile?.specialties?.[0] || null;
  const storeLocation = profile?.location ?? null;

  // ── Quotes pending manual payment validation ──────────────────────────────
  interface PendingPaymentQuote {
    id: string;
    requestId: string;
    storeName: string;
    total: number;
    proofImageUrl?: string;
    status: string;
    createdAt?: any;
  }
  const [pendingPaymentQuotes, setPendingPaymentQuotes]   = useState<PendingPaymentQuote[]>([]);
  const [preparingQuotes, setPreparingQuotes]             = useState<PendingPaymentQuote[]>([]);
  const [shippedQuotes, setShippedQuotes]                 = useState<PendingPaymentQuote[]>([]);
  const [deliveredQuotes, setDeliveredQuotes]             = useState<PendingPaymentQuote[]>([]);
  const [loadingPayments, setLoadingPayments]             = useState(false);
  const [proofModalUrl, setProofModalUrl]                 = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId]             = useState<string | null>(null);

  const { getCurrentUser } = useApi();

  const loadPendingPayments = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    setLoadingPayments(true);
    try {
      // El backend retorna las cotizaciones pendientes de validación de esta tienda
      const sentQuotes = await getStoreSentQuotes();
      const pending = sentQuotes
        .filter(q => q.status === 'pending_validation')
        .map(q => ({ ...q, status: q.status }));
      const preparing = sentQuotes
        .filter(q => q.status === 'preparing' || q.status === 'paid')
        .map(q => ({ ...q, status: q.status }));
      const shipped = sentQuotes
        .filter(q => q.status === 'shipped')
        .map(q => ({ ...q, status: q.status }));
      const delivered = sentQuotes
        .filter(q => q.status === 'delivered')
        .map(q => ({ ...q, status: q.status }));
      setPendingPaymentQuotes(pending as any);
      setPreparingQuotes(preparing as any);
      setShippedQuotes(shipped as any);
      setDeliveredQuotes(delivered as any);
    } catch (e) {
      console.error('[Ferry/StorePanel] loadPendingPayments', e);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleConfirmPayment = async (q: PendingPaymentQuote) => {
    setActionLoadingId(q.id);
    try {
      await updateQuoteLogisticStatus(q.id, q.requestId, 'preparing');
      setPendingPaymentQuotes(prev => prev.filter(x => x.id !== q.id));
      setPreparingQuotes(prev => [...prev, { ...q, status: 'preparing' }]);
    } catch (e) {
      console.error('[Ferry/StorePanel] confirmPayment', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkShipped = async (q: PendingPaymentQuote) => {
    setActionLoadingId(q.id);
    try {
      await updateQuoteLogisticStatus(q.id, q.requestId, 'shipped');
      setPreparingQuotes(prev => prev.filter(x => x.id !== q.id));
      setShippedQuotes(prev => [...prev, { ...q, status: 'shipped' }]);
    } catch (e) {
      console.error('[Ferry/StorePanel] markShipped', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'ORDERS') loadPendingPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadInbox = async () => {
    if (!storeCategory) return;
    setIsLoadingInbox(true);
    setInboxError(null);
    try {
      const [results, catalog] = await Promise.all([
        getPendingRequestsForStore(storeCategory, storeLocation),
        getStorePriceCatalog().catch(() => ({} as Record<string, StoreCatalogEntry>)),
      ]);
      setInboxRequests(results);
      setStoreCatalog(catalog);
    } catch (err: any) {
      setInboxError('No se pudo cargar la bandeja. Verifica tu conexión.');
    } finally {
      setIsLoadingInbox(false);
    }
  };

  useEffect(() => {
    // Cargar estadísticas iniciales para los contadores del header
    loadInbox();
    loadSentQuotes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Refrescar datos específicos al cambiar de pestaña
    if (activeTab === 'INBOX') loadInbox();
    if (activeTab === 'QUOTES') loadSentQuotes();
    if (activeTab === 'ORDERS') loadPendingPayments();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store Identity from Profile or fallback
  const MY_STORE_NAME = profile?.displayName || "Ferretería El Tornillo";
  const MY_STORE_LOGO = profile?.photoURL;

  // Filter Logic
  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING_QUOTES);

  const myOrders = sentQuotes.filter(q => 
    q.status === 'paid' || 
    q.status === 'preparing' || 
    q.status === 'shipped' || 
    q.status === 'delivered'
  );


  const handleQuoteSuccess = (reqId: string) => {
    setQuotingInboxRequest(null);
    // Remove from inbox so the store can't double-submit
    setInboxRequests(prev => prev.filter(r => r.id !== reqId));
    setQuoteToastSuccess(true);
    setTimeout(() => setQuoteToastSuccess(false), 3500);
    // Reload sent quotes and jump to Enviadas tab
    loadSentQuotes().then(() => setActiveTab('QUOTES'));
  };

  const handleConfirmReject = async () => {
    if (!confirmRejectId) return;
    try {
      await rejectQuoteRequest(confirmRejectId);
      setRejectedIds(prev => new Set([...prev, confirmRejectId]));
      setConfirmRejectId(null);
      setRejectToastVisible(true);
      setTimeout(() => setRejectToastVisible(false), 3000);
    } catch (error) {
      console.error('Error rejecting request:', error);
      setConfirmRejectId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Quote sent toast ── */}
      {/* ── Reject confirmation modal ── */}
      {confirmRejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">¿Rechazar solicitud?</h3>
            <p className="text-xs text-slate-400 mb-5">Confirma si quieres rechazar esta solicitud. No podrás deshacerlo.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRejectId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm"
              >
                Sí, rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject success toast ── */}
      {rejectToastVisible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-3 rounded-2xl shadow-xl shadow-red-200/60 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300 max-w-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold text-sm">Listo, está rechazado</p>
        </div>
      )}

      {quoteToastSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-2xl shadow-xl shadow-green-200/60 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300 max-w-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold text-sm">¡Cotización enviada al cliente!</p>
        </div>
      )}

      {/* ── Quote Response Modal ── */}
      {quotingInboxRequest && (
        <QuoteResponseModal
          req={quotingInboxRequest}
          storeName={MY_STORE_NAME}
          storeId={getCurrentUser()?.uid || ''}
          onClose={() => setQuotingInboxRequest(null)}
          onSuccess={handleQuoteSuccess}
        />
      )}

      {/* Header - Styled to match image */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/20 overflow-hidden">
              {MY_STORE_LOGO ? (
                <img src={MY_STORE_LOGO} className="w-full h-full object-cover" alt="Logo" />
              ) : (
                <Store className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{MY_STORE_NAME}</h2>
              <div className="flex items-center gap-2 text-xs text-green-400 font-medium mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Abierto ahora
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-0 mt-4 pt-6 border-t border-white/10">
            <div className="text-center">
              <span className="block text-2xl font-black text-white">{inboxRequests.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Nuevas</span>
            </div>
            <div className="text-center border-x border-white/10">
              <span className="block text-2xl font-black text-white">{sentQuotes.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Enviadas</span>
            </div>
            <div className="text-center border-r border-white/10">
              <span className="block text-2xl font-black text-white">{myOrders.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Cerradas</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-black text-white">–</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Catálogo</span>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-ferry-500 rounded-full blur-3xl opacity-10 -mr-10 -mt-10"></div>
      </div>

      {/* Tabs — Sales Funnel: Nuevas → Enviadas → Ventas Cerradas → Catálogo */}
      <div className="flex p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm gap-0.5">
        <button
          onClick={() => setActiveTab('INBOX')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 relative ${
            activeTab === 'INBOX'
              ? 'bg-ferry-100 text-ferry-800 border-b-2 border-ferry-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" /> Nuevas
          {inboxRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {inboxRequests.length > 9 ? '9+' : inboxRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('QUOTES')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'QUOTES'
              ? 'bg-ferry-100 text-ferry-800 border-b-2 border-ferry-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Send className="w-3.5 h-3.5" /> Enviadas
        </button>
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'ORDERS'
              ? 'bg-ferry-100 text-ferry-800 border-b-2 border-ferry-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-500 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Cerradas
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">

        {/* --- INBOX TAB --- */}
        {activeTab === 'INBOX' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">

            {/* Header row */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-ferry-600" /> Nuevas — Por Cotizar
                </h3>
                {storeCategory && (
                  <p className="text-xs text-slate-400 mt-0.5">Categoría: <span className="font-semibold text-ferry-600">{storeCategory}</span></p>
                )}
              </div>
              <button
                onClick={loadInbox}
                disabled={isLoadingInbox}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoadingInbox ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* No category configured */}
            {!storeCategory && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-600 text-sm">Configura tu especialidad</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                  Ve a tu Perfil → Especialidades y activa una categoría para ver solicitudes.
                </p>
              </div>
            )}

            {/* Skeleton loaders */}
            {storeCategory && isLoadingInbox && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="h-3 bg-slate-200 rounded-full w-1/3" />
                        <div className="h-4 bg-slate-200 rounded-full w-2/3" />
                      </div>
                      <div className="h-6 w-16 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full w-full" />
                    <div className="h-9 bg-slate-100 rounded-xl w-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {storeCategory && !isLoadingInbox && inboxError && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {inboxError}
              </div>
            )}

            {/* Empty state */}
            {storeCategory && !isLoadingInbox && !inboxError && inboxRequests.length === 0 && (
              <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-ferry-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-ferry-300" />
                </div>
                <p className="font-bold text-slate-600 text-sm">Sin solicitudes por ahora</p>
                <p className="text-xs text-slate-400 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                  Aún no hay solicitudes de cotización en tu zona. ¡Mantente atento!
                </p>
                <button
                  onClick={loadInbox}
                  className="mt-4 text-xs font-bold text-ferry-600 flex items-center gap-1 mx-auto hover:underline"
                >
                  <RefreshCw className="w-3 h-3" /> Actualizar
                </button>
              </div>
            )}

            {/* Request cards */}
            {storeCategory && !isLoadingInbox && !inboxError && inboxRequests.filter(r => !rejectedIds.has(r.id) && r.status !== 'rejected').map(req => {
              // ── Catalog intelligence ─────────────────────────────────────
              const catalogHits = req.items.map(item => {
                const key = item.name.toLowerCase().trim();
                const entry = storeCatalog[key];
                const qty = Math.max(parseFloat(item.quantity) || 1, 0.001);
                return entry ? { found: true, lineTotal: Math.round(entry.price * qty) } : { found: false, lineTotal: 0 };
              });
              const matchCount   = catalogHits.filter(h => h.found).length;
              const matchPct     = req.items.length > 0 ? Math.round(matchCount / req.items.length * 100) : 0;
              const autoEstimate = catalogHits.reduce((s, h) => s + h.lineTotal, 0);
              const hasCatalog   = Object.keys(storeCatalog).length > 0;
              // Displayed value: manual override > auto-estimate > empty
              const displayedCost = estimatedCosts[req.id] !== undefined
                ? estimatedCosts[req.id]
                : (autoEstimate > 0 ? String(autoEstimate) : '');

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* ── Ticket header ── */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-ferry-500 animate-pulse flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-ferry-600 uppercase tracking-wide">
                            {req.category}
                          </span>
                          {req.displayId && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wide">
                              Ref: {req.displayId}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">{formatRelativeTime(req.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${req.distanceKm !== undefined
                          ? 'bg-ferry-50 text-ferry-700 border border-ferry-100'
                          : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}>
                        <MapPin className="w-2.5 h-2.5" />
                        {req.distanceKm !== undefined
                          ? req.distanceKm < 1
                            ? `${(req.distanceKm * 1000).toFixed(0)} m`
                            : `${req.distanceKm.toFixed(1)} km`
                          : 'Dist. desconocida'}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        {req.items.length} ítem{req.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* ── Dashed separator ── */}
                  <div className="border-b border-dashed border-slate-200 mx-4" />

                  {/* ── Items list (order ticket body) ── */}
                  <div className="mx-4 my-3 bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Artículos solicitados</p>
                    {req.items.map((item, idx) => {
                      const hit = catalogHits[idx];
                      const displayName = buildItemDisplayName(item);
                      return (
                        <div key={idx} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            {hasCatalog && (
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${hit.found ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            )}
                            <span className="text-xs text-slate-700 font-semibold leading-snug break-words">
                              {displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                            {hit.found && (
                              <span className="text-[10px] font-semibold text-emerald-600">
                                ${hit.lineTotal.toLocaleString('es-CO')}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Delivery address ── */}
                  {req.deliveryAddress && (
                    <>
                      <div className="border-b border-dashed border-slate-200 mx-4" />
                      <div className="mx-4 my-3 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-ferry-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirección de entrega</p>
                          <p className="text-xs text-slate-700 font-medium leading-snug mt-0.5">{req.deliveryAddress}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Dashed separator ── */}
                  <div className="border-b border-dashed border-slate-200 mx-4" />

                  {/* ── Footer: cost + actions ── */}
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Costo aproximado */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      {hasCatalog && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                          matchPct === 100 ? 'bg-emerald-100 text-emerald-700' :
                          matchPct >= 50  ? 'bg-amber-100 text-amber-700' :
                                           'bg-slate-100 text-slate-500'
                        }`}>
                          {matchPct}%
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                        {hasCatalog ? 'Estimado' : 'Costo aprox.'}
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="0"
                          value={displayedCost}
                          onChange={e => setEstimatedCosts(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className={`w-full pl-5 pr-2 py-0.5 border rounded-lg text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-ferry-400 focus:border-ferry-400 transition-shadow ${
                            autoEstimate > 0 && estimatedCosts[req.id] === undefined
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Botones acción */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmRejectId(req.id)}
                        className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => setQuotingInboxRequest(req)}
                        className="flex-[2] py-2.5 bg-ferry-600 hover:bg-ferry-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-ferry-200"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Ver y Cotizar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- ENVIADAS TAB --- */}
        {activeTab === 'QUOTES' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-ferry-600" /> Enviadas — Esperando Respuesta
              </h3>
              <button onClick={loadSentQuotes} className="text-slate-400 hover:text-slate-600 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loadingSent ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingSent ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            ) : sentQuotes.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-amber-300" />
                </div>
                <p className="font-bold text-slate-600 text-sm">Sin cotizaciones enviadas</p>
                <p className="text-xs text-slate-400 mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                  Cuando envíes una cotización aparecerá aquí mientras el cliente decide.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentQuotes.map(q => (
                  <div key={q.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                        #{q.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Esperando cliente
                      </span>
                    </div>

                    {/* Items — show store prices (pre-markup) */}
                    <div className="space-y-1">
                      {(() => {
                        const itemsList = q.storeItems ?? q.items ?? [];
                        return (
                          <>
                            {itemsList.filter(i => i.available).slice(0, 3).map((item, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-slate-600 truncate flex-1 mr-2">{item.name} × {item.quantity}</span>
                                <span className="font-semibold text-slate-800 shrink-0">${(item.subtotal ?? 0).toLocaleString('es-CO')}</span>
                              </div>
                            ))}
                            {itemsList.filter(i => i.available).length > 3 && (
                              <p className="text-[10px] text-slate-400">
                                + {itemsList.filter(i => i.available).length - 3} artículo(s) más
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                      <div className="text-xs text-slate-500">
                        {q.transportCost === 0
                          ? <span className="text-emerald-600 font-semibold">✓ Envío gratis</span>
                          : <span>Envío: ${(q.transportCost ?? 0).toLocaleString('es-CO')}</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Total a recibir</p>
                        <p className="font-black text-ferry-600 text-base">${(q.storeTotal ?? q.total ?? 0).toLocaleString('es-CO')}</p>
                        <p className="text-[10px] text-slate-400">Total cobrado al cliente: ${(q.total ?? 0).toLocaleString('es-CO')}</p>
                      </div>
                    </div>

                    {q.message && (
                      <p className="text-[10px] text-slate-400 italic border-t border-slate-50 pt-1.5">"{q.message}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VENTAS CERRADAS TAB --- */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">

            {/* ── Sección 1: Comprobantes pendientes de aprobación ── */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Por cobrar — Aprobar comprobante
                  {pendingPaymentQuotes.length > 0 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      {pendingPaymentQuotes.length}
                    </span>
                  )}
                </h3>
                <button onClick={loadPendingPayments} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loadingPayments ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingPayments ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Cargando...
                </div>
              ) : pendingPaymentQuotes.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">Sin comprobantes por revisar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPaymentQuotes.map(q => (
                    <div key={q.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                            Pedido #{q.id.slice(-5).toUpperCase()}
                          </p>
                          <p className="font-black text-ferry-600 text-lg mt-0.5">
                            $ {((q.storeTotal ?? q.total) ?? 0).toLocaleString('es-CO')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Total cobrado al cliente: ${(q.total ?? 0).toLocaleString('es-CO')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full whitespace-nowrap">
                          Pago en validación
                        </span>
                      </div>

                      {/* Items que se están pagando */}
                      <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Artículos del pedido:</p>
                        {(() => {
                          const itemsList = (q as any).storeItems ?? (q as any).items ?? [];
                          return itemsList.filter((i: any) => i.available).map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-slate-600 truncate flex-1 mr-2">{item.name} × <span className="font-bold text-slate-800">{item.quantity}</span></span>
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Ver comprobante */}
                      {q.proofImageUrl ? (
                        <button
                          onClick={() => setProofModalUrl(q.proofImageUrl!)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Ver comprobante
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-1">Sin imagen adjunta</p>
                      )}

                      {/* Confirmar pago */}
                      <button
                        onClick={() => handleConfirmPayment(q)}
                        disabled={actionLoadingId === q.id}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors"
                      >
                        {actionLoadingId === q.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {actionLoadingId === q.id ? 'Confirmando...' : 'Confirmar Pago'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sección 2: Por despachar (preparing) ── */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-ferry-600" />
                  Alistando — Por Despachar
                  {preparingQuotes.length > 0 && (
                    <span className="text-[10px] font-bold bg-ferry-100 text-ferry-700 px-1.5 py-0.5 rounded-full">
                      {preparingQuotes.length}
                    </span>
                  )}
                </h3>
              </div>

              {preparingQuotes.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">Sin pedidos en preparación</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {preparingQuotes.map(q => (
                    <div key={q.id} className="bg-white rounded-2xl border-2 border-ferry-200 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                            Pedido #{q.id.slice(-5).toUpperCase()}
                          </p>
                          <p className="font-black text-ferry-600 text-lg mt-0.5">
                            $ {((q.storeTotal ?? q.total) ?? 0).toLocaleString('es-CO')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Total cobrado al cliente: ${(q.total ?? 0).toLocaleString('es-CO')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-ferry-100 text-ferry-700 px-2 py-1 rounded-full">
                          Alistando 📦
                        </span>
                      </div>

                      {/* Items que deben prepararse */}
                      <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Artículos a empacar:</p>
                        {(() => {
                          const itemsList = (q as any).storeItems ?? (q as any).items ?? [];
                          return itemsList.filter((i: any) => i.available).map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-slate-600 truncate flex-1 mr-2">{item.name} × <span className="font-bold text-slate-800">{item.quantity}</span></span>
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Yango link */}
                      <a
                        href="https://yango.com/es-co/delivery/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold transition-colors"
                      >
                        <Truck className="w-4 h-4" /> Programar envío en Yango
                      </a>

                      {/* WhatsApp Client */}
                      {q.clientPhone && (
                        <a
                          href={`https://wa.me/${q.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(q.clientName || 'cliente')},%20somos%20la%20ferretería%20preparando%20tu%20pedido%20en%20Ferry`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.383 0 0 5.383 0 12.031c0 2.115.548 4.175 1.594 5.992L0 24l6.152-1.564c1.748.966 3.708 1.474 5.879 1.474 6.648 0 12.031-5.383 12.031-12.031S18.679 0 12.031 0zm0 22.046c-1.802 0-3.568-.485-5.116-1.404l-.367-.217-3.805.967.98-3.707-.238-.379c-1.009-1.604-1.541-3.463-1.541-5.382 0-5.614 4.568-10.182 10.182-10.182 5.614 0 10.182 4.568 10.182 10.182 0 5.614-4.568 10.182-10.182 10.182zM17.6 15.11c-.305-.153-1.805-.891-2.084-.992-.279-.102-.483-.153-.686.153-.203.305-.788.992-.966 1.196-.178.203-.356.229-.661.076-1.748-.842-3.037-1.83-4.148-3.435-.285-.41.3-.393.889-1.574.076-.153.038-.28-.038-.432-.076-.153-.686-1.654-.94-2.264-.247-.594-.497-.514-.686-.523-.178-.009-.382-.009-.585-.009-.203 0-.534.076-.813.382C6.444 8.04 5.58 8.854 5.58 10.507c0 1.654 1.22 3.257 1.393 3.486.173.23 2.375 3.633 5.753 5.094 2.215.955 3.03.864 4.14.736 1.345-.155 2.871-1.173 3.277-2.308.406-1.135.406-2.107.285-2.311-.122-.204-.428-.328-.733-.481z"/></svg>
                          WhatsApp del Cliente
                        </a>
                      )}

                      {/* Marcar en camino */}
                      <button
                        onClick={() => handleMarkShipped(q)}
                        disabled={actionLoadingId === q.id}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-ferry-600 hover:bg-ferry-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors"
                      >
                        {actionLoadingId === q.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Truck className="w-4 h-4" />
                        )}
                        {actionLoadingId === q.id ? 'Actualizando...' : 'Marcar como En Camino'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sección 3: En Camino (shipped) ── */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2 mt-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-blue-500" />
                  En Camino — Esperando Cliente
                  {shippedQuotes.length > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      {shippedQuotes.length}
                    </span>
                  )}
                </h3>
              </div>
              {shippedQuotes.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">Sin pedidos en tránsito</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shippedQuotes.map(q => (
                    <div key={q.id} className="bg-white rounded-2xl border-2 border-blue-100 p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                            Pedido #{q.id.slice(-5).toUpperCase()}
                          </p>
                          <p className="font-black text-ferry-600 text-lg mt-0.5">
                            $ {((q.storeTotal ?? q.total) ?? 0).toLocaleString('es-CO')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Total cobrado al cliente: ${(q.total ?? 0).toLocaleString('es-CO')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                          En Tránsito
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        El contratista debe confirmar la entrega desde su panel para finalizar la orden.
                      </p>
                      {/* WhatsApp / Contact Button */}
                      {q.clientPhone && (
                        <a
                          href={`https://wa.me/${q.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(q.clientName || 'cliente')},%20somos%20la%20ferretería%20escribiéndote%20por%20tu%20pedido%20en%20Ferry`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.383 0 0 5.383 0 12.031c0 2.115.548 4.175 1.594 5.992L0 24l6.152-1.564c1.748.966 3.708 1.474 5.879 1.474 6.648 0 12.031-5.383 12.031-12.031S18.679 0 12.031 0zm0 22.046c-1.802 0-3.568-.485-5.116-1.404l-.367-.217-3.805.967.98-3.707-.238-.379c-1.009-1.604-1.541-3.463-1.541-5.382 0-5.614 4.568-10.182 10.182-10.182 5.614 0 10.182 4.568 10.182 10.182 0 5.614-4.568 10.182-10.182 10.182zM17.6 15.11c-.305-.153-1.805-.891-2.084-.992-.279-.102-.483-.153-.686.153-.203.305-.788.992-.966 1.196-.178.203-.356.229-.661.076-1.748-.842-3.037-1.83-4.148-3.435-.285-.41.3-.393.889-1.574.076-.153.038-.28-.038-.432-.076-.153-.686-1.654-.94-2.264-.247-.594-.497-.514-.686-.523-.178-.009-.382-.009-.585-.009-.203 0-.534.076-.813.382C6.444 8.04 5.58 8.854 5.58 10.507c0 1.654 1.22 3.257 1.393 3.486.173.23 2.375 3.633 5.753 5.094 2.215.955 3.03.864 4.14.736 1.345-.155 2.871-1.173 3.277-2.308.406-1.135.406-2.107.285-2.311-.122-.204-.428-.328-.733-.481z"/></svg>
                          Contactar Cliente
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sección 4: Entregadas (Historial) ── */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2 mt-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Historial Entregadas
                  {deliveredQuotes.length > 0 && (
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      {deliveredQuotes.length}
                    </span>
                  )}
                </h3>
              </div>
              {deliveredQuotes.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">Aún no hay pedidos entregados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveredQuotes.map(q => (
                    <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                            Pedido #{q.id.slice(-5).toUpperCase()}
                          </p>
                          <p className="font-black text-ferry-600 text-base mt-0.5">
                            $ {((q.storeTotal ?? q.total) ?? 0).toLocaleString('es-CO')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Total cobrado al cliente: ${(q.total ?? 0).toLocaleString('es-CO')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Entregado
                        </span>
                      </div>
                      {(q as any).reviewComment && (
                        <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <svg key={star} className={`w-3 h-3 ${(q as any).rating >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                            ))}
                          </div>
                          <p className="text-xs text-slate-600 italic">"{(q as any).reviewComment}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal comprobante de pago */}
        {proofModalUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
               onClick={() => setProofModalUrl(null)}>
            <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setProofModalUrl(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
              <img src={proofModalUrl} alt="Comprobante de pago" className="w-full rounded-2xl shadow-2xl" />
              <a
                href={proofModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-white rounded-xl text-slate-700 font-bold text-sm shadow"
              >
                Abrir en pantalla completa
              </a>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};
