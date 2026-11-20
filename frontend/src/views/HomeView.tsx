
import React, { useState, useEffect } from 'react';
import { MaterialRequest, RequestStatus } from '../types';
import { TopStoresSection } from '../components/TopStoresSection';
import { PromocionesSection } from '../components/PromocionesSection';
import { ShoppingBag, Briefcase, Store, TrendingUp, FileText, Package, ChevronRight, ChevronDown, UserCog, ArrowRight } from 'lucide-react';
import { getRecentPendingQuotes, RecentPendingQuote, rejectQuote } from '../services/quoteService';

// ---------------------------------------------------------------------------
// Notification feed hook
// ---------------------------------------------------------------------------

const useRecentQuotes = (enabled: boolean) => {
  const [quotes, setQuotes] = useState<RecentPendingQuote[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    // Los invitados no tienen sesión: pedirlo solo devolvería un 401
    if (!enabled) return;
    let cancelled = false;
    getRecentPendingQuotes(3)
      // Solo las que esperan respuesta del cliente; las aceptadas o pagadas ya no son "¡Cotización lista!"
      .then(data => { if (!cancelled) setQuotes(data.filter(q => !q.status || q.status === 'sent').slice(0, 3)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { quotes, setQuotes, loading };
};

const pesos = (n?: number) => (typeof n === 'number' ? `$${n.toLocaleString('es-CO')}` : '');

// Nombre de la solicitud y su primer artículo; si hay más, una flecha despliega el resto.
const ResumenSolicitud: React.FC<{ q: RecentPendingQuote }> = ({ q }) => {
  const [abierto, setAbierto] = useState(false);
  const items = q.items ?? [];
  if (!q.requestTitle && items.length === 0) return null;
  const linea = (it: NonNullable<RecentPendingQuote['items']>[number], i: number) => (
    <li key={i} className={`flex gap-1.5 text-xs ${it.available === false ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
      <span className="font-bold shrink-0">{it.quantity}x</span>
      <span className="truncate">{it.name}</span>
    </li>
  );
  return (
    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {q.requestTitle && <p className="text-sm font-bold text-slate-800 truncate">{q.requestTitle}</p>}
          {items[0] && <ul className="mt-0.5">{linea(items[0], 0)}</ul>}
        </div>
        {items.length > 1 && (
          <button
            onClick={() => setAbierto(a => !a)}
            className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-ferry-600 px-2 py-1 rounded-lg hover:bg-ferry-50"
            aria-expanded={abierto}
            aria-label={abierto ? 'Ocultar artículos' : 'Ver todos los artículos'}
          >
            +{items.length - 1}
            <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {abierto && <ul className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5">{items.slice(1).map((it, i) => linea(it, i + 1))}</ul>}
    </div>
  );
};

const buildNotificationMessage = (q: RecentPendingQuote, idx: number): string => {
  const alias = `Experto Local #${idx + 1}`;
  const label = q.requestTitle || q.requestDisplayId || 'tu solicitud';
  if (q.availableItems === q.totalItems) {
    return `${alias} ya envió la cotización para ${label}.`;
  }
  return `${alias} cotizó ${q.availableItems} de ${q.totalItems} productos. Algunos artículos no están en stock.`;
};

// ---------------------------------------------------------------------------

interface Props {
  userName: string;
  ongoingRequest?: MaterialRequest;
  onNavigate: (view: 'SHOP' | 'HUB' | 'QUOTES') => void;
  onOpenRequest: (reqId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  calcularDistancia?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  isGuest?: boolean;
  onRegister?: (role: 'constructor' | 'ferreteria') => void;
  // Aceptar una cotización lleva a pagarla (aceptar y pagar es un solo paso)
  onAceptarCotizacion?: (quoteId: string) => void;
}

export const HomeView: React.FC<Props> = ({
  userName, ongoingRequest, onNavigate, onOpenRequest, userLocation, calcularDistancia, isGuest = false, onRegister, onAceptarCotizacion,
}) => {
  const { quotes: recentQuotes, setQuotes: setRecentQuotes, loading: quotesLoading } = useRecentQuotes(!isGuest);
  const [rechazando, setRechazando] = useState<string | null>(null);

  const rechazar = async (q: RecentPendingQuote) => {
    if (!window.confirm(`¿Rechazar esta cotización de ${pesos(q.total)}?`)) return;
    setRechazando(q.id);
    try {
      await rejectQuote(q.id, q.requestId);
      setRecentQuotes(prev => prev.filter(x => x.id !== q.id));
    } catch {
      alert('No se pudo rechazar. Intenta de nuevo.');
    } finally {
      setRechazando(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Section */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-1">Hola, {userName} 👋</h2>
          <p className="text-slate-400 mb-6 text-sm">¿Qué proyecto vamos a sacar adelante hoy?</p>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate('SHOP')}
              className="flex-1 bg-ferry-600 hover:bg-ferry-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-ferry-900/50"
            >
              <ShoppingBag className="w-4 h-4" /> Materiales
            </button>
            {isGuest ? (
              <button
                onClick={() => onRegister?.('constructor')}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-sm transition-all"
              >
                <ArrowRight className="w-4 h-4" /> Iniciar Sesión
              </button>
            ) : (
              <button
                onClick={() => onNavigate('HUB')}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-sm transition-all"
              >
                <Briefcase className="w-4 h-4" /> Servicios
              </button>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-ferry-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
      </div>

      {/* CTAs de registro — solo para invitados */}
      {isGuest && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
          <p className="text-xs text-slate-500 font-bold mb-2">Regístrate para más beneficios</p>
          <div className="flex flex-col gap-3">

            {/* Usuario / Profesional */}
            <button
              onClick={() => onRegister?.('constructor')}
              className="w-full bg-white border border-gray-200 rounded-2xl p-3 text-left flex flex-row items-center gap-3 hover:border-[#1a2744] hover:shadow-md active:scale-[0.98] transition-all duration-200"
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <UserCog className="w-8 h-8 text-[#1a2744]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-base leading-tight">Soy Usuario / Profesional</p>
                <p className="text-gray-500 text-sm mt-0.5 leading-snug">Cotiza, compra materiales y ofrece tus servicios</p>
              </div>
            </button>

            {/* Ferretería */}
            <button
              onClick={() => onRegister?.('ferreteria')}
              className="w-full bg-white border border-gray-200 rounded-2xl p-3 text-left flex flex-row items-center gap-3 hover:border-ferry-500 hover:shadow-md active:scale-[0.98] transition-all duration-200"
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <Store className="w-8 h-8 text-ferry-500" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-base leading-tight">Soy Ferretería</p>
                <p className="text-gray-500 text-sm mt-0.5 leading-snug">Vende a nuevos clientes locales</p>
              </div>
            </button>

          </div>
          <p className="text-center mt-4 text-xs text-slate-400 font-medium">
            ¿Ya tienes cuenta?{' '}
            <button 
              onClick={() => onRegister?.('constructor')}
              className="text-ferry-600 font-bold hover:underline transition-all"
            >
              Inicia sesión aquí
            </button>
          </p>
        </div>
      )}

      {/* Ongoing Request Card */}
      {ongoingRequest ? (
        <div
          className="bg-white p-4 rounded-xl border border-ferry-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
          onClick={() => onOpenRequest(ongoingRequest.id)}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-ferry-500"></div>
          <div className="flex justify-between items-center mb-2 pl-2">
            <h3 className="font-bold text-slate-700">Pedido en curso</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${ongoingRequest.status === RequestStatus.PENDING_QUOTES ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {ongoingRequest.status === RequestStatus.PENDING_QUOTES ? 'Cotizando' : 'Activo'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500 pl-2">
            <div className={`w-2 h-2 rounded-full ${ongoingRequest.status === RequestStatus.PENDING_QUOTES ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`}></div>
            {ongoingRequest.status === RequestStatus.PENDING_QUOTES ? 'Las ferreterías están ofertando...' : 'Tu pedido está en camino.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quotesLoading ? (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
              <TrendingUp className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">Revisando tu bandeja...</span>
            </div>
          ) : recentQuotes.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
              <TrendingUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <span className="text-sm">Tus solicitudes están activas. Te avisaremos cuando los expertos respondan.</span>
            </div>
          ) : (
            recentQuotes.map((q, idx) => {
              const isPartial = q.availableItems < q.totalItems;
              return (
                <div key={q.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${isPartial ? 'border-l-4 border-l-orange-500' : ''}`}>
                <button
                  onClick={() => onNavigate('QUOTES')}
                  className="w-full text-left flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPartial ? 'bg-amber-100' : 'bg-orange-100'}`}>
                    {isPartial
                      ? <Package className="w-5 h-5 text-orange-600" />
                      : <FileText className="w-5 h-5 text-orange-600" />
                    }
                  </div>

                  {/* Text */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-bold text-gray-900 leading-tight">
                      {isPartial ? 'Cotización parcial recibida' : '¡Cotización lista!'}
                    </span>
                    <span className="text-xs text-gray-600 leading-snug mt-0.5 line-clamp-2">
                      {buildNotificationMessage(q, idx)}
                    </span>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </button>
                <ResumenSolicitud q={q} />
                {/* Respuesta rápida: precio, rechazar o aceptar (aceptar abre el pago) */}
                {(!q.status || q.status === 'sent') && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                    {typeof q.total === 'number' && (
                      <span className="text-base font-black text-ferry-700 mr-auto">{pesos(q.total)}</span>
                    )}
                    <button
                      onClick={() => rechazar(q)}
                      disabled={rechazando === q.id}
                      className="px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                    >
                      {rechazando === q.id ? '...' : 'Rechazar'}
                    </button>
                    <button
                      onClick={() => (onAceptarCotizacion ? onAceptarCotizacion(q.id) : onNavigate('QUOTES'))}
                      className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700"
                    >
                      Aceptar
                    </button>
                  </div>
                )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mejor calificadas: calificaciones reales de clientes; sin datos, la sección no se muestra */}
      <TopStoresSection userLocation={userLocation} calcularDistancia={calcularDistancia} />

      {/* Promociones que publican las ferreterías, filtradas por su especialidad */}
      <PromocionesSection userLocation={userLocation} calcularDistancia={calcularDistancia} />
    </div>
  );
};
