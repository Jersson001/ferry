
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Plus, Trash2, Truck, MapPin, Check, CheckCircle2, ArrowLeft, CreditCard, Banknote, Lock, Star, Hammer, Droplets, Zap, Lightbulb, PaintRoller, Key, Flame, BrickWall, ChevronDown, ChevronUp, XCircle, X as CloseIcon, AlertCircle, AlertTriangle, Info, Paperclip, Mic, Inbox, Wrench } from 'lucide-react';
import { MaterialRequest, MaterialItem, RequestStatus, Quote } from '../types';
import { analyzeMaterialImage, extractMaterialsFromText } from '../services/geminiService';
import { sendQuoteRequest } from '../services/quoteService';
import { saveGuestCart, clearGuestCart, GuestCart } from '../hooks/useGuestCart';
import { Button, Card, Badge, StarRating } from '../components/UIComponents';
import { MessageSquareText, FileText } from 'lucide-react';
import { UserProfile } from '../types';
import { getConfigProducto, inferirMedidaNominal, inferirCaracteristica, corregirNombreOCR, MODULE_PRODUCTS } from '../config/herrajesConfig';
import { usePlacesAutocomplete, PlacePick } from '../hooks/usePlacesAutocomplete';
import { PlaceSuggestionsDropdown } from '../components/PlaceSuggestionsDropdown';

interface Props {
  onRequestCreate: (req: MaterialRequest) => void;
  activeRequest?: MaterialRequest;
  onAcceptQuote: (reqId: string, quoteId: string) => void;
  onRejectQuote?: (reqId: string, quoteId: string) => void;
  onBack: () => void;
  onFinishOrder: (reqId: string, rating: number) => void;
  onNavigate?: (view: 'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'QUOTES') => void;
  stores?: UserProfile[];
  userLocation?: { lat: number; lng: number };
  // Guest mode
  isGuest?: boolean;
  onNeedsAuth?: () => void;
  restoredCart?: GuestCart | null;
  autoSubmitAfterLogin?: boolean;
}

// Custom IPE beam icon for Estructural
const BeamIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement> & { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    {/* Top flange */}
    <line x1="4" y1="5" x2="20" y2="5" />
    {/* Web */}
    <line x1="12" y1="5" x2="12" y2="19" />
    {/* Bottom flange */}
    <line x1="4" y1="19" x2="20" y2="19" />
  </svg>
);

const SPECIALTIES = [
  { id: 'Plomería', icon: Droplets, color: 'text-blue-500', bg: 'from-blue-100 to-blue-50', shadow: 'shadow-blue-200/50' },
  { id: 'Eléctricos', icon: Zap, color: 'text-yellow-500', bg: 'from-yellow-100 to-yellow-50', shadow: 'shadow-yellow-200/50' },
  { id: 'Depósito', icon: BrickWall, color: 'text-orange-600', bg: 'from-orange-100 to-orange-50', shadow: 'shadow-orange-200/50' },
  { id: 'Pintura', icon: PaintRoller, color: 'text-pink-500', bg: 'from-pink-100 to-pink-50', shadow: 'shadow-pink-200/50' },
  { id: 'Carpintería', icon: Hammer, color: 'text-amber-700', bg: 'from-amber-100 to-amber-50', shadow: 'shadow-amber-200/50' },
  { id: 'Iluminación', icon: Lightbulb, color: 'text-yellow-400', bg: 'from-yellow-100 to-yellow-50', shadow: 'shadow-yellow-200/50' },
  { id: 'Cerrajería', icon: Key, color: 'text-slate-600', bg: 'from-slate-200 to-slate-100', shadow: 'shadow-slate-200/50' },
  { id: 'Gas', icon: Flame, color: 'text-red-500', bg: 'from-red-100 to-red-50', shadow: 'shadow-red-200/50' },
  { id: 'Estructural', icon: BeamIcon, color: 'text-slate-700', bg: 'from-slate-100 to-slate-50', shadow: 'shadow-slate-200/50' },
  { id: 'Herramientas', icon: Wrench, color: 'text-green-600', bg: 'from-green-100 to-green-50', shadow: 'shadow-green-200/50' },
];

// ─── BROADCAST ANIMATION SVG ─────────────────────────────────────────────────
type AnimPhase = 'broadcast' | 'analyze';

interface BroadcastDiagramProps {
  arrivedCount: number;
  phase: AnimPhase;
}

const BroadcastDiagram: React.FC<BroadcastDiagramProps> = ({ arrivedCount, phase }) => {
  const CX = 150, CY = 190, R = 106;

  // 5 store positions: fan arc 210° → 330° (SVG coords, y-down)
  const stores = [210, 240, 270, 300, 330].map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    return { i, x: Math.round(CX + R * Math.cos(rad)), y: Math.round(CY + R * Math.sin(rad)) };
  });
  // Results: (58,137), (97,98), (150,84), (203,98), (242,137)

  return (
    <div className="w-full select-none">
      <svg viewBox="0 0 300 232" className="w-full max-w-[288px] mx-auto" aria-hidden="true">

        {/* ── Subtle city-grid map background ── */}
        <defs>
          <pattern id="ferry-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 L0 0 0 22" fill="none" stroke="#e2e8f0" strokeWidth="0.6"/>
          </pattern>
        </defs>
        <rect width="300" height="232" fill="url(#ferry-grid)" opacity="0.6" rx="14"/>

        {/* ── Static dashed connection lines ── */}
        {stores.map(s => (
          <line key={`l-${s.i}`}
            x1={CX} y1={CY} x2={s.x} y2={s.y}
            stroke={s.i < arrivedCount ? '#16a34a' : '#cbd5e1'}
            strokeWidth={s.i < arrivedCount ? 2 : 1}
            strokeDasharray={s.i < arrivedCount ? undefined : '5 4'}
            opacity={s.i < arrivedCount ? 1 : 0.55}
          />
        ))}

        {/* ── Orange traveling pulses (broadcast phase only) ── */}
        {phase === 'broadcast' && stores.map(s => {
          const dur = `${1.0 + s.i * 0.1}s`;
          const beg = `${s.i * 0.16}s`;
          return (
            <circle key={`p-${s.i}`} r="5" fill="#f97316">
              <animateMotion path={`M${CX},${CY} L${s.x},${s.y}`} dur={dur} begin={beg} repeatCount="indefinite" calcMode="linear"/>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.82;1" dur={dur} begin={beg} repeatCount="indefinite"/>
            </circle>
          );
        })}

        {/* ── Green return data line (per responded store) ── */}
        {stores.map(s => {
          if (s.i >= arrivedCount) return null;
          const len = Math.round(Math.hypot(CX - s.x, CY - s.y));
          return (
            <line key={`rl-${s.i}`}
              x1={s.x} y1={s.y} x2={CX} y2={CY}
              stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={len} strokeDashoffset={len}
            >
              <animate attributeName="stroke-dashoffset" from={len} to={0} dur="0.7s" fill="freeze"/>
            </line>
          );
        })}

        {/* ── Store nodes ── */}
        {stores.map(s => {
          const responded = s.i < arrivedCount;
          return (
            <g key={`st-${s.i}`}>

              {/* Pulsing indigo ring (analyze phase) */}
              {phase === 'analyze' && !responded && (
                <circle cx={s.x} cy={s.y} r="18" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <animate attributeName="r" values="18;27;18" dur={`${2.0 + s.i * 0.28}s`} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0;0.5" dur={`${2.0 + s.i * 0.28}s`} repeatCount="indefinite"/>
                </circle>
              )}

              {/* Green burst ring (on respond) */}
              {responded && (
                <circle cx={s.x} cy={s.y} r="18" fill="none" stroke="#22c55e" strokeWidth="2">
                  <animate attributeName="r" from="18" to="33" dur="0.55s" fill="freeze"/>
                  <animate attributeName="opacity" from="0.8" to="0" dur="0.55s" fill="freeze"/>
                </circle>
              )}

              {/* Main circle */}
              <circle cx={s.x} cy={s.y} r="18"
                fill={responded ? '#dcfce7' : '#f8fafc'}
                stroke={responded ? '#16a34a' : phase === 'analyze' ? '#6366f1' : '#94a3b8'}
                strokeWidth={responded ? 2.5 : 1.5}
              />

              {/* Icon — store / magnifying glass / checkmark */}
              {responded ? (
                <polyline
                  points={`${s.x - 6},${s.y + 1} ${s.x - 2},${s.y + 5} ${s.x + 7},${s.y - 5}`}
                  fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                />
              ) : phase === 'analyze' ? (
                <g>
                  <circle cx={s.x - 1.5} cy={s.y - 2} r="6" fill="none" stroke="#6366f1" strokeWidth="1.8"/>
                  <line x1={s.x + 3} y1={s.y + 3} x2={s.x + 7} y2={s.y + 7} stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round"/>
                </g>
              ) : (
                <g fill="#94a3b8">
                  <polygon points={`${s.x},${s.y - 9} ${s.x - 8},${s.y - 3} ${s.x + 8},${s.y - 3}`}/>
                  <rect x={s.x - 6} y={s.y - 3} width="12" height="10" rx="1"/>
                  <rect x={s.x - 2.5} y={s.y + 2} width="5" height="5" rx="0.5" fill="white"/>
                </g>
              )}

              {/* Label */}
              <text x={s.x} y={s.y + 30} textAnchor="middle" fontSize="6.5"
                fill={responded ? '#16a34a' : '#64748b'}
                fontFamily="system-ui, sans-serif"
                fontWeight={responded ? '700' : '500'}
              >
                Experta {s.i + 1}
              </text>
            </g>
          );
        })}

        {/* ── Central user node ── */}
        <g>
          {/* Broadcast pulse ring */}
          {phase === 'broadcast' && (
            <circle cx={CX} cy={CY} r="22" fill="none" stroke="#fb923c" strokeWidth="2">
              <animate attributeName="r" values="22;44;22" dur="1.7s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.7s" repeatCount="indefinite"/>
            </circle>
          )}
          <circle cx={CX} cy={CY} r="22" fill="#fff7ed" stroke="#f97316" strokeWidth="2.5"/>
          {/* Person silhouette */}
          <circle cx={CX} cy={CY - 7} r="6.5" fill="#f97316"/>
          <path d={`M ${CX - 13} ${CY + 14} Q ${CX} ${CY + 4} ${CX + 13} ${CY + 14}`} fill="#f97316"/>
        </g>

      </svg>
    </div>
  );
};

// ─── WAITING SCREEN ───────────────────────────────────────────────────────────
interface WaitingProps {
  activeRequest: MaterialRequest;
  onBack: () => void;
  onNavigate?: (view: 'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'QUOTES') => void;
  userLocation?: { lat: number; lng: number };
}

type WaitStatus = 'broadcasting' | 'reviewing' | 'quoted';

const WaitingForQuotes: React.FC<WaitingProps> = ({ activeRequest, onBack, onNavigate, userLocation }) => {
  const [arrivedCount, setArrivedCount] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>('broadcast');
  const [isCancelling, setIsCancelling] = useState(false);

  // Broadcast → analyze transition
  useEffect(() => {
    const t = setTimeout(() => setPhase('analyze'), 3400);
    return () => clearTimeout(t);
  }, []);

  // Polling cada 10s para contar cotizaciones recibidas (reemplaza onSnapshot)
  useEffect(() => {
    if (!activeRequest.id) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
    const token = localStorage.getItem('access_token');

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/quotes/requests/${activeRequest.id}/quote-count`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setArrivedCount(data.count ?? 0);
        }
      } catch { /* silently ignore */ }
    };

    poll(); // llamada inmediata
    const interval = setInterval(poll, 10000); // polling cada 10s
    return () => clearInterval(interval);
  }, [activeRequest.id]);

  // Cancelar solicitud via API y volver al inicio
  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
      const token = localStorage.getItem('access_token');
      await fetch(`${API_URL}/quotes/requests/${activeRequest.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch { /* si falla el update igual volvemos */ }
    onBack();
  };

  // Estado dinámico según datos reales
  const waitStatus: WaitStatus =
    arrivedCount > 0 ? 'quoted' :
    phase === 'analyze' ? 'reviewing' :
    'broadcasting';

  const statusConfig = {
    broadcasting: {
      title: 'Buscando expertos...',
      msg: 'Notificando a tiendas expertas en tu zona...',
      titleColor: 'text-slate-800',
      msgColor: 'text-slate-500',
      dot: null,
    },
    reviewing: {
      title: 'Revisando tu lista...',
      msg: 'Las tiendas están analizando tu listado de materiales.',
      titleColor: 'text-ferry-800',
      msgColor: 'text-ferry-600',
      dot: 'bg-ferry-500',
    },
    quoted: {
      title: arrivedCount === 1 ? '¡Cotización recibida!' : `¡${arrivedCount} cotizaciones!`,
      msg: arrivedCount === 1
        ? '¡Una tienda experta ya envió su oferta!'
        : `¡${arrivedCount} tiendas ya enviaron sus ofertas!`,
      titleColor: 'text-green-800',
      msgColor: 'text-green-600',
      dot: 'bg-green-500',
    },
  }[waitStatus];

  // Mapa de fondo: Static Maps API centrado en ubicación del usuario
  const mapCoords = userLocation
    ?? (() => {
      try { return JSON.parse(localStorage.getItem('ferry_coords') ?? 'null'); } catch { return null; }
    })();
  const mapCenter = mapCoords
    ? `${mapCoords.lat},${mapCoords.lng}`
    : '4.710989,-74.072092'; // Bogotá fallback
  const MAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapBgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${mapCenter}&zoom=14&size=400x700&scale=2` +
    `&style=feature:all|element:labels|visibility:off` +
    `&style=feature:road|element:geometry|color:0xffffff` +
    `&style=feature:landscape|color:0xf1f5f9` +
    `&style=feature:water|color:0xbae6fd` +
    `&style=feature:poi|visibility:off` +
    `&key=${MAP_KEY}`;

  return (
    <div className="relative animate-in fade-in duration-500 pb-4">

      {/* ── Mapa de fondo ── */}
      <div className="absolute inset-0 -mx-4 -mt-4 rounded-b-3xl overflow-hidden" style={{ height: '340px' }}>
        <img
          src={mapBgUrl}
          alt="mapa"
          className="w-full h-full object-cover"
          style={{ opacity: 0.28 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white" />
      </div>

      {/* ── Contenido sobre el mapa ── */}
      <div className="relative z-10 space-y-4 pt-2">

        {/* Encabezado de estado */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            {statusConfig.dot && (
              <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dot} ${waitStatus !== 'broadcasting' ? 'animate-ping' : ''}`} />
            )}
            <h2 className={`text-xl font-bold ${statusConfig.titleColor}`}>{statusConfig.title}</h2>
          </div>
          <p className={`text-sm mt-0.5 font-medium transition-all duration-500 ${statusConfig.msgColor}`}>
            {statusConfig.msg}
          </p>
        </div>

        {/* Animación radar SVG */}
        <BroadcastDiagram arrivedCount={arrivedCount} phase={phase} />

        {/* CTA cotización recibida */}
        {waitStatus === 'quoted' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 bg-green-50 border-2 border-green-300 rounded-2xl p-4 shadow-md shadow-green-100">
            <p className="text-green-800 font-bold text-sm text-center mb-3">
              🎉 {arrivedCount === 1 ? 'Tienes una nueva oferta lista para revisar' : `Tienes ${arrivedCount} ofertas listas para revisar`}
            </p>
            <Button
              onClick={() => onNavigate?.('QUOTES')}
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
            >
              <Inbox className="w-4 h-4 mr-1" /> Ver cotizaciones
            </Button>
          </div>
        )}

        {/* Nota de privacidad */}
        <div className="flex items-start gap-2 bg-white/90 border border-slate-100 rounded-xl px-3 py-2.5">
          <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Los nombres de las tiendas se revelan solo al aceptar una cotización, garantizando precios justos.
          </p>
        </div>

        {/* Acciones */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 text-ferry-500" />
            Crear otra solicitud
          </button>
          <button
            disabled={isCancelling}
            onClick={handleCancel}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-slate-400 text-sm font-medium hover:text-red-500 transition-colors disabled:opacity-60"
          >
            {isCancelling
              ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              : <ArrowLeft className="w-4 h-4" />}
            {isCancelling ? 'Cancelando...' : 'Cancelar espera'}
          </button>
        </div>

      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

export const MaterialFlow: React.FC<Props> = ({ onRequestCreate, activeRequest, onAcceptQuote, onRejectQuote, onBack, onFinishOrder, onNavigate, userLocation, isGuest = false, onNeedsAuth, restoredCart, autoSubmitAfterLogin = false }) => {
  const [mode, setMode] = useState<'INITIAL' | 'SCANNING' | 'EDITING' | 'QUOTES' | 'PAYMENT' | 'TRACKING' | 'RATING' | 'TEXT_INPUT'>('INITIAL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedQuoteForPayment, setSelectedQuoteForPayment] = useState<Quote | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'NEQUI' | 'CARD' | 'PSE'>('NEQUI');
  const [userRating, setUserRating] = useState(0);
  const [addressQuery, setAddressQuery] = useState('');
  const [isGpsActive, setIsGpsActive] = useState(() => localStorage.getItem('ferry_disponible') === 'true');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [isAddressValidated, setIsAddressValidated] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const deliveryAddressInputRef = useRef<HTMLInputElement>(null);
  // Autocompletado de Google (Places API New) para los dos campos de dirección:
  // el de la obra, arriba, y el de entrega, en la pantalla de edición.
  const addressPlaces = usePlacesAutocomplete();
  const deliveryPlaces = usePlacesAutocomplete();

  const applyAddressPick = (pick: PlacePick) => {
    setAddressQuery(pick.address);
    setIsAddressValidated(true);
    setShowAddressSuggestions(false);
    setDeliveryAddress(pick.address);
    localStorage.setItem('ferry_direccion_entrega', pick.address);
    setDeliveryCoordinates({ lat: pick.lat, lng: pick.lng });
  };

  const applyDeliveryPick = (pick: PlacePick) => {
    setDeliveryAddress(pick.address);
    setAddressError(false);
    localStorage.setItem('ferry_direccion_entrega', pick.address);
    setDeliveryCoordinates({ lat: pick.lat, lng: pick.lng });
  };
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [quoteSentSuccess, setQuoteSentSuccess] = useState(false);
  const [quoteTitle, setQuoteTitle] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(() => localStorage.getItem('ferry_direccion_entrega') ?? '');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<string[]>(() => {
    const saved = localStorage.getItem('ferry_saved_addresses');
    return saved ? JSON.parse(saved) : [];
  });
  const [filteredAddresses, setFilteredAddresses] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteItems, setIncompleteItems] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === RESTAURAR CARRITO DE INVITADO ===
  useEffect(() => {
    if (restoredCart && restoredCart.items.length > 0) {
      setItems(restoredCart.items);
      setSelectedCategory(restoredCart.selectedCategory);
      setDeliveryAddress(restoredCart.deliveryAddress);
      setQuoteTitle(restoredCart.quoteTitle);
      setMode('EDITING');
    }
  }, [restoredCart]);

  // Auto-submit tras login si había carrito pendiente
  const autoSubmitDoneRef = useRef(false);
  useEffect(() => {
    if (autoSubmitAfterLogin && !isGuest && !autoSubmitDoneRef.current && items.length > 0 && selectedCategory && deliveryAddress.trim()) {
      autoSubmitDoneRef.current = true;
      const timer = setTimeout(() => submitRequest(), 800);
      return () => clearTimeout(timer);
    }
  }, [autoSubmitAfterLogin, isGuest, items, selectedCategory, deliveryAddress]);

  // === AUTO-SAVE CARRITO INVITADO a localStorage ===
  useEffect(() => {
    if (!isGuest || items.length === 0) return;
    saveGuestCart({ items, selectedCategory, deliveryAddress, quoteTitle });
  }, [isGuest, items, selectedCategory, deliveryAddress, quoteTitle]);

  // === DICTADO POR VOZ ===
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const toggleDictation = () => {
    if (isListening) {
      shouldListenRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      setInterimText('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome o Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true; 

    recognition.onresult = (event: any) => {
      // Reseteamos el contador porque el usuario está hablando
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e) {}
        }
        setIsListening(false);
        setInterimText('');
      }, 15000);

      let finalTranscript = '';
      let currentInterim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      setInterimText(currentInterim);

      if (finalTranscript) {
        const processed = finalTranscript.replace(/\blisto\b/gi, '\n').trim();
        if (processed) {
          setTextInput(prev => {
            const separator = prev && !prev.endsWith('\n') ? ' ' : '';
            return prev + separator + processed;
          });
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Error en dictado:", e.error);
      if (e.error === 'not-allowed' || e.error === 'aborted') {
        shouldListenRef.current = false;
        setIsListening(false);
        setInterimText('');
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (e) {}
          }
        }, 300);
      } else {
        setIsListening(false);
        setInterimText('');
      }
    };

    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    
    try {
      recognition.start();
      setIsListening(true);
      // Iniciar el temporizador inicial de 15 segundos
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e) {}
        }
        setIsListening(false);
        setInterimText('');
      }, 15000);
    } catch (e) {
      console.error("Error al iniciar dictado:", e);
      setIsListening(false);
      shouldListenRef.current = false;
    }
  };

  // Expanded state for quotes breakdown
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // === ESTADO PARA EL MODAL DE EDICIÓN DE PRODUCTO ===
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    cantidad: string; unidad: string; nombreComercial: string;
    medidaNominal: string; caracteristica: string; nombre: string;
    tipoCorredera: string; tipoSoporte: string; observacion: string;
  }>({
    cantidad: '', unidad: '', nombreComercial: '', medidaNominal: '',
    caracteristica: '', nombre: '', tipoCorredera: '', tipoSoporte: '', observacion: '',
  });

  // === FUNCIONES DE VALIDACIÓN (migrado de ferry_usuarios) ===
  const getEstadoProducto = (item: MaterialItem) => {
    const nombreComercial = corregirNombreOCR((item.nombreComercial || item.name || '').trim());
    const nombreUC = nombreComercial.toUpperCase();
    const medidaNominal = (item.medidaNominal || '').trim();
    const caracteristica = (item.caracteristica || '').trim();
    if (!nombreComercial) return { color: '#ef4444', tipo: 'rojo' as const };

    const configProducto = getConfigProducto(nombreComercial);
    if (!configProducto) return { color: '#f59e0b', tipo: 'amarillo' as const };

    // Separar campos faltantes en: funcionales (→ rojo) vs cosméticos/color (→ amarillo)
    let faltaFuncional = false;
    let faltaCosmetico = false;

    for (const grupo of configProducto.grupos) {
      const esColor = grupo.label.toLowerCase() === 'color';
      if (grupo.campo === 'medidaNominal') {
        const val = medidaNominal;
        if (!val || val.includes('falta')) { faltaFuncional = true; }
      } else if (grupo.campo === 'caracteristica') {
        const val = caracteristica;
        if (!val || val.includes('falta')) {
          const yaEnNombre = grupo.opciones.some(op => nombreUC.includes(op.toUpperCase()));
          if (!yaEnNombre) {
            if (esColor) faltaCosmetico = true; else faltaFuncional = true;
          }
        }
      } else if (grupo.campo === 'tipoCorredera') {
        if (!item.tipoCorredera) {
          // Check if type is already in the name
          const yaEnNombre = grupo.opciones.some(op => nombreUC.includes(op.toUpperCase()));
          if (!yaEnNombre) faltaFuncional = true;
        }
      }
    }

    // Bisagra: tipo de montaje + tipo de cierre
    const esBisagra = nombreComercial.toLowerCase().includes('bisagra');
    if (esBisagra) {
      const tieneTipoMontaje = ['PARCHE', 'SEMIPARCHE', 'EMBEBIDA'].some(t => nombreUC.includes(t) || caracteristica.toUpperCase().includes(t));
      if (!tieneTipoMontaje) faltaFuncional = true;
    }
    // Bisagra/Corredera: tipo de cierre
    const esCorredera = nombreComercial.toLowerCase().includes('corredera');
    if (esBisagra || esCorredera) {
      const tieneCierre = ['CIERRE SUAVE', 'CIERRE NORMAL', 'PUSH'].some(c => nombreUC.includes(c) || caracteristica.toUpperCase().includes(c));
      if (!tieneCierre) faltaFuncional = true;
    }

    if (!faltaFuncional && !faltaCosmetico) return { color: '#10b981', tipo: 'verde' as const };
    if (faltaFuncional) return { color: '#ef4444', tipo: 'rojo' as const };
    return { color: '#f59e0b', tipo: 'amarillo' as const }; // solo falta color
  };

  const normalizarProductos = (productos: MaterialItem[]): MaterialItem[] => {
    return productos.map(p => {
      const nombreRaw = (p.nombreComercial || p.name || '').trim();
      const nombreComercial = corregirNombreOCR(nombreRaw);
      let medida = (p.medidaNominal || '').trim();
      const isModuleProduct = MODULE_PRODUCTS.some(mp => nombreComercial.toLowerCase().includes(mp));
      if (isModuleProduct) {
        // Módulos: MOD + número
        const matchMod = medida.match(/^(?:DE\s+)?(\d+)$/i);
        if (matchMod) medida = `MOD${matchMod[1]}`;
        if (medida.includes('falta') || !medida) {
          const numMatch = nombreComercial.match(/\b(\d{2,3})\b/);
          if (numMatch) medida = `MOD${numMatch[1]}`;
        }
      } else {
        // No-módulos: usar inferirMedidaNominal (ej: corredera 45 → 45cm)
        medida = inferirMedidaNominal(nombreComercial, medida);
      }
      const caracteristica = inferirCaracteristica(nombreComercial, (p.caracteristica || '').trim());
      let tipoCorredera = p.tipoCorredera || '';
      const nombreLower = nombreComercial.toLowerCase();
      if (nombreLower.includes('corredera') && !tipoCorredera) {
        if (nombreLower.includes('full') || nombreLower.includes('extensi')) tipoCorredera = 'FULL EXTENSIÓN';
        else if (nombreLower.includes('oculta')) tipoCorredera = 'OCULTA';
        else if (nombreLower.includes('sencilla') || nombreLower.includes('simple')) tipoCorredera = 'SENCILLA';
      }
      // Build clean structured name so item.name never holds raw Gemini/OCR text
      const ncUpper = nombreComercial.toUpperCase();
      const mnFiltrado = medida && !medida.includes('falta') && !ncUpper.includes(medida.toUpperCase()) ? medida : '';
      const caPartes = caracteristica.split(',').map(cp => cp.trim()).filter(cp => cp && !cp.includes('falta') && !ncUpper.includes(cp.toUpperCase())).join(', ');
      const cleanName = [nombreComercial, mnFiltrado, caPartes].filter(v => v && v.trim()).join(' - ') || nombreComercial;

      return { ...p, name: cleanName, nombreComercial, medidaNominal: medida, caracteristica, tipoCorredera };
    });
  };

  const openEditModal = (idx: number) => {
    const item = items[idx];
    const nc = item.nombreComercial || item.name || '';
    const mn = (item.medidaNominal || '').replace(/\s*\(falta[^)]*\)/gi, '').trim();
    const ca = (item.caracteristica || '').replace(/\s*\(falta[^)]*\)/gi, '').trim();

    const medidaInferida = inferirMedidaNominal(nc, mn);
    const caInferida = inferirCaracteristica(nc, ca);

    // Limpiar características huérfanas: si el producto tiene config, descartar
    // valores que no pertenecen a ningún grupo del config actual (ni son texto libre).
    const config = getConfigProducto(nc);
    const caLimpia = (() => {
      if (!config) return caInferida;
      const chipsActuales = config.grupos.flatMap(g => g.opciones.map(o => o.toUpperCase()));
      const tieneGrupoEditable = config.grupos.some(g => g.editable);
      return caInferida.split(',').map(p => p.trim()).filter(p => {
        if (!p) return false;
        if (chipsActuales.includes(p.toUpperCase())) return true; // chip válido del config actual
        if (tieneGrupoEditable) return true;                       // texto libre (color personalizado)
        return false;                                               // chip huérfano → descartar
      }).join(', ');
    })();

    // Si la medida nominal es una unidad de presentación reconocida, usarla como unidad del ítem
    const unidadFinal = /GL|M³|M3\b|SACO/i.test(medidaInferida) ? medidaInferida : item.unit;

    setEditingIndex(idx);
    setEditValues({
      cantidad: item.quantity, unidad: unidadFinal,
      nombreComercial: nc,
      medidaNominal: medidaInferida,
      caracteristica: caLimpia,
      nombre: item.name || '', tipoCorredera: item.tipoCorredera || '',
      tipoSoporte: '', observacion: item.observacion || '',
    });
  };

  const saveEditModal = () => {
    if (editingIndex === null) return;
    const nc = corregirNombreOCR((editValues.nombreComercial || editValues.nombre || '').trim());
    const mn = (editValues.medidaNominal || '').replace(/\s*\(falta[^)]*\)/gi, '').trim();
    const ca = (editValues.caracteristica || '').replace(/\s*\(falta[^)]*\)/gi, '').trim();
    let ncFinal = nc;
    const tipoCorr = (editValues.tipoCorredera || '').trim();
    if (tipoCorr && nc.toLowerCase().includes('corredera') && !nc.toUpperCase().includes(tipoCorr)) {
      ncFinal = nc.replace(/corredera/i, `CORREDERA ${tipoCorr}`);
    }
    // Si seleccionó un tipo de soporte, reemplazar "soporte(s)" con el tipo específico
    const tipoSop = (editValues.tipoSoporte || '').trim();
    if (tipoSop) {
      ncFinal = ncFinal.replace(/soportes?/i, tipoSop);
    }
    // Si la medida es MOD + número, quitar el número suelto del nombre base
    const modMatch = mn.match(/^MOD(\d+)$/i);
    if (modMatch) {
      ncFinal = ncFinal.replace(new RegExp(`\\b${modMatch[1]}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
    }
    // Filtrar partes que ya están en el nombre para no duplicar
    const ncUpper = ncFinal.toUpperCase();
    const mnFiltrado = mn && !ncUpper.includes(mn.toUpperCase()) ? mn : '';
    const caPartes = ca.split(',').map(p => p.trim()).filter(p => p && !ncUpper.includes(p.toUpperCase())).join(', ');
    const cuerpoCompleto = [ncFinal, mnFiltrado, caPartes].filter(v => v && v.trim()).join(' - ');
    const newItems = [...items];
    newItems[editingIndex] = {
      ...newItems[editingIndex],
      quantity: editValues.cantidad, unit: editValues.unidad,
      nombreComercial: ncFinal, medidaNominal: mn, caracteristica: ca,
      name: cuerpoCompleto, tipoCorredera: editValues.tipoCorredera || '',
      observacion: editValues.observacion,
    };
    setItems(newItems);
    setEditingIndex(null);
  };

  const handleAddNewItem = () => {
    const newItem = { name: '', quantity: '1', unit: 'und', nombreComercial: '', medidaNominal: '', caracteristica: '' };
    setItems(prev => [...prev, newItem]);
    setEditingIndex(items.length);
    setEditValues({
      cantidad: '1', unidad: 'und', nombreComercial: '', medidaNominal: '', caracteristica: '',
      nombre: '', tipoCorredera: '', tipoSoporte: '', observacion: ''
    });
  };

  /**
   * La IA responde 503 cuando su credencial no es válida o el proyecto no tiene acceso.
   * Reintentar no sirve, así que en vez de dejar al usuario sin salida le ofrecemos
   * capturar los materiales a mano. Devuelve true si ya se manejó el error.
   */
  const handleAiUnavailable = (error: any): boolean => {
    if (error?.status !== 503) return false;

    const irManual = window.confirm(
      `${error.message}\n\n¿Quieres agregarlos a mano ahora?`
    );
    if (irManual) {
      setItems([{ name: '', quantity: '1', unit: 'und', nombreComercial: '', medidaNominal: '', caracteristica: '' }]);
      setEditingIndex(0);
      setEditValues({
        cantidad: '1', unidad: 'und', nombreComercial: '', medidaNominal: '', caracteristica: '',
        nombre: '', tipoCorredera: '', tipoSoporte: '', observacion: ''
      });
      setMode('EDITING');
    } else {
      setMode('INITIAL');
    }
    return true;
  };

  // If we receive an active request in a specific state, sync the view mode
  React.useEffect(() => {
    if (activeRequest) {
      if (activeRequest.status === RequestStatus.PENDING_QUOTES) setMode('INITIAL');
      if (activeRequest.status === RequestStatus.QUOTED) setMode('QUOTES');
      if (activeRequest.status === RequestStatus.PAID || activeRequest.status === RequestStatus.DELIVERED) {
        if (mode !== 'RATING') {
          setMode('TRACKING');
        }
      }
    } else {
      setMode('INITIAL');
    }
  }, [activeRequest]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setMode('SCANNING');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const cleanBase64 = base64.split(',')[1];

      try {
        const recognizedItems = await analyzeMaterialImage(cleanBase64);
        setItems(normalizarProductos(recognizedItems));
        setMode('EDITING');
      } catch (error: any) {
        if (!handleAiUnavailable(error)) {
          alert(error.message || 'Error al procesar la imagen con Inteligencia Artificial.');
          setMode('INITIAL');
        }
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTextExtraction = async () => {
    if (!textInput.trim()) return;
    setIsAnalyzing(true);
    setMode('SCANNING');
    try {
      const recognizedItems = await extractMaterialsFromText(textInput);
      setItems(normalizarProductos(recognizedItems));
      setMode('EDITING');
    } catch (error: any) {
      if (!handleAiUnavailable(error)) {
        alert(error.message || 'Error al procesar el texto con Inteligencia Artificial.');
        setMode('TEXT_INPUT');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  /** Resolves the user's current GPS position. Returns null if unavailable or denied. */
  const resolveUserLocation = (): Promise<{ lat: number; lng: number } | null> => {
    // Prefer the location already passed from the parent
    if (userLocation) return Promise.resolve(userLocation);

    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  };

  const submitRequest = async () => {
    // Intercepción invitado: guardar carrito y pedir registro
    if (isGuest) {
      saveGuestCart({ items, selectedCategory, deliveryAddress, quoteTitle });
      onNeedsAuth?.();
      return;
    }

    // Bloqueo duro: productos con indicador rojo
    if (items.length > 0) {
      const rojos = items.filter(item => getEstadoProducto(item).tipo === 'rojo');
      if (rojos.length > 0) {
        setIncompleteItems(rojos.map(item => (item.nombreComercial || item.name || 'Producto sin nombre').trim()));
        setShowIncompleteModal(true);
        return;
      }
    }

    if (!selectedCategory) {
      setCategoryError(true);
      return;
    }
    setCategoryError(false);

    if (!deliveryAddress.trim()) {
      setAddressError(true);
      return;
    }
    setAddressError(false);
    setGpsError(null);
    setIsSendingQuote(true);

    // Resolve location — use deliveryCoordinates if available (the obra location), else fallback to userLocation/GPS
    let resolvedLocation = deliveryCoordinates;
    if (!resolvedLocation) {
      resolvedLocation = await resolveUserLocation();
    }
    // We do NOT block the request if resolvedLocation is still null/undefined.
    // The deliveryAddress text is the primary source of truth, and userLocation is optional.

    // Construir payload final: uppercase + misma deduplicación que getDisplayName()
    const itemsLimpios = items.map(item => {
      const mn = (item.medidaNominal || '').replace(/\s*\(falta[^)]*\)/gi, '').trim().toUpperCase();
      const ca = (item.caracteristica || '').replace(/\s*\(falta[^)]*\)/gi, '').trim().toUpperCase();
      let nc = (item.nombreComercial || item.name || '').replace(/\s*\(falta[^)]*\)/gi, '').trim().toUpperCase();

      // Quitar número suelto del nombre base si coincide con la medida (igual que getDisplayName)
      const modMatch = mn.match(/^MOD(\d+)$/i);
      if (modMatch) nc = nc.replace(new RegExp(`\\b${modMatch[1]}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
      const cmMatch = mn.match(/^(\d+)\s*(CM|NW|MM|PULGADAS?|"|'')?$/i);
      if (cmMatch) nc = nc.replace(new RegExp(`\\b${cmMatch[1]}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();

      const mnClean = mn && !nc.includes(mn) ? mn : '';
      const caClean = ca.split(',').map(p => p.trim()).filter(p => p && !nc.includes(p)).join(', ');
      const name = [nc, mnClean, caClean].filter(v => v && v.trim()).join(' - ');
      return {
        ...item,
        name: name || nc,
        medidaNominal: mn,
        caracteristica: ca,
      };
    });

    const finalTitle = quoteTitle.trim() || (selectedCategory ? `Pedido ${selectedCategory}` : `Pedido ${new Date().toLocaleDateString()}`);

    let backendRequestId: string = Date.now().toString(); // fallback
    try {
      backendRequestId = await sendQuoteRequest({
        category: selectedCategory || 'General',
        items: itemsLimpios,
        userLocation: resolvedLocation,
        title: finalTitle,
        deliveryAddress: deliveryAddress.trim(),
      });
    } catch (error) {
      console.error('Error al enviar cotización a Firestore:', error);
      // Continue even if backend fails — local flow still works
    } finally {
      setIsSendingQuote(false);
    }

    const newRequest: MaterialRequest = {
      id: backendRequestId, // ← ID real del backend para polling
      title: finalTitle,
      date: new Date().toISOString(),
      category: selectedCategory || 'General',
      items: itemsLimpios,
      status: RequestStatus.PENDING_QUOTES,
      quotes: []
    };

    clearGuestCart(); // limpiar carrito temporal tras envío exitoso
    setQuoteSentSuccess(true);
    setTimeout(() => {
      setQuoteSentSuccess(false);
      onRequestCreate(newRequest);
      setMode('INITIAL');
      setItems([]);
      setQuoteTitle('');
      setDeliveryAddress('');
      setAddressError(false);
    }, 2500);
  };

  const handleBack = () => {
    if (mode === 'EDITING') {
      setMode('INITIAL');
      setItems([]);
    } else if (mode === 'PAYMENT') {
      setMode('QUOTES');
      setSelectedQuoteForPayment(null);
    } else {
      onBack();
    }
  };

  const handleInitiatePayment = (quote: Quote) => {
    setSelectedQuoteForPayment(quote);
    setMode('PAYMENT');
  };

  const handleConfirmPayment = () => {
    if (!activeRequest || !selectedQuoteForPayment) return;

    setIsProcessingPayment(true);
    setTimeout(() => {
      onAcceptQuote(activeRequest.id, selectedQuoteForPayment.id);
      setIsProcessingPayment(false);
    }, 2000);
  };

  const getActiveQuote = () => {
    if (!activeRequest || !activeRequest.selectedQuoteId) return null;
    return activeRequest.quotes.find(q => q.id === activeRequest.selectedQuoteId);
  };


  if (mode === 'INITIAL' && !activeRequest) {
    return (
      <div className="space-y-6 pb-20">

        {/* ── Dirección de entrega ── */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">

          {/* Dirección — Google Places Autocomplete + Historial */}
          <div className="relative">
            <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 transition-colors duration-200 ${isAddressValidated ? 'text-orange-500' : 'text-gray-400'}`} />
            <input
              ref={addressInputRef}
              type="text"
              value={addressQuery}
              placeholder="Dirección de la obra (Ej: Calle 100 # 15-20)"
              onChange={e => {
                const val = e.target.value;
                setAddressQuery(val);
                setIsAddressValidated(false);
                addressPlaces.search(val);

                // Filtrar direcciones guardadas
                if (val.trim().length > 0) {
                  const filtered = savedAddresses.filter(addr => 
                    addr.toLowerCase().includes(val.toLowerCase())
                  );
                  setFilteredAddresses(filtered);
                  setShowAddressSuggestions(filtered.length > 0);
                } else {
                  setShowAddressSuggestions(false);
                }
              }}
              onFocus={() => {
                if (addressQuery.trim().length === 0 && savedAddresses.length > 0) {
                  setFilteredAddresses(savedAddresses.slice(0, 5));
                  setShowAddressSuggestions(true);
                }
              }}
              onBlur={e => {
                setTimeout(() => {
                  setShowAddressSuggestions(false);
                  addressPlaces.clear();
                }, 200);
                const val = e.target.value.trim();
                if (val.length > 3) {
                  setIsAddressValidated(true);
                  setDeliveryAddress(val);
                  
                  // Guardar en historial si no está ya
                  if (!savedAddresses.includes(val)) {
                    const updated = [val, ...savedAddresses.slice(0, 9)];
                    setSavedAddresses(updated);
                    localStorage.setItem('ferry_saved_addresses', JSON.stringify(updated));
                  }
                  localStorage.setItem('ferry_direccion_entrega', val);
                }
              }}
              className={`w-full pl-9 pr-9 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200
                ${isAddressValidated ? 'border-orange-400 ring-1 ring-orange-400' : 'border-gray-200 focus:ring-orange-500'}`}
            />
            {isAddressValidated && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none z-10" />
            )}
            
            {/* Direcciones guardadas + sugerencias de Google, en una sola lista */}
            <PlaceSuggestionsDropdown
              saved={showAddressSuggestions ? filteredAddresses : []}
              onPickSaved={addr => {
                setAddressQuery(addr);
                setDeliveryAddress(addr);
                setIsAddressValidated(true);
                setShowAddressSuggestions(false);
                addressPlaces.clear();
                localStorage.setItem('ferry_direccion_entrega', addr);
              }}
              predictions={addressPlaces.predictions}
              onPickPrediction={async prediction => {
                const pick = await addressPlaces.select(prediction);
                if (pick) applyAddressPick(pick);
              }}
            />
          </div>

          {/* Detalles de la obra */}
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={deliveryDetails}
              onChange={e => setDeliveryDetails(e.target.value)}
              placeholder="Detalles: Torre 3, portón verde, piso 2... (Opcional)"
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* ── Acción principal: arriba del todo ── */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {selectedCategory ? `¿Qué necesitas de ${selectedCategory}?` : '¿Qué materiales necesitas?'}
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            {selectedCategory ? `Cotiza solo con expertos en ${selectedCategory.toLowerCase()}.` : 'Cotiza en segundos con las mejores ferreterías.'}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Card onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center justify-center h-40 border-2 border-dashed border-ferry-200 hover:border-ferry-500 transition-all hover:-translate-y-1 hover:shadow-lg bg-ferry-50 cursor-pointer">
              <div className="flex items-center gap-2 mb-3 relative">
                <Camera
                  className="w-9 h-9 text-ferry-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-5deg] relative z-10"
                  style={{ filter: 'drop-shadow(0px 8px 8px rgba(0,0,0,0.15)) drop-shadow(0px 2px 2px rgba(255,100,0,0.3))' }}
                  strokeWidth={2}
                />
                <Paperclip
                  className="w-8 h-8 text-slate-700 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[5deg]"
                  style={{ filter: 'drop-shadow(0px 8px 8px rgba(0,0,0,0.15)) drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }}
                  strokeWidth={2}
                />
                <div className="absolute top-1 left-1.5 w-2 h-2 bg-white/70 rounded-full blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>
              </div>
              <span className="font-bold text-ferry-800 text-base">Sube tu Lista</span>
              <span className="text-[11px] text-center text-ferry-600/70 mt-1">Foto, imagen o PDF</span>
            </Card>

            <Card onClick={() => setMode('TEXT_INPUT')} className="group flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 hover:border-slate-400 transition-all hover:-translate-y-1 hover:shadow-lg bg-white cursor-pointer">
              <div className="flex items-center gap-2 mb-3 relative">
                <MessageSquareText
                  className="w-9 h-9 text-slate-500 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-5deg] relative z-10"
                  style={{ filter: 'drop-shadow(0px 8px 8px rgba(0,0,0,0.1)) drop-shadow(0px 2px 2px rgba(0,0,0,0.2))' }}
                  strokeWidth={2}
                />
                <Mic
                  className="w-8 h-8 text-slate-400 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[5deg]"
                  style={{ filter: 'drop-shadow(0px 8px 8px rgba(0,0,0,0.1)) drop-shadow(0px 2px 2px rgba(0,0,0,0.15))' }}
                  strokeWidth={2}
                />
                <div className="absolute top-1 left-2 w-2 h-2 bg-white/80 rounded-full blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>
              </div>
              <span className="font-bold text-slate-700 text-base">Escribir Lista</span>
              <span className="text-[11px] text-center text-slate-500 mt-1">Escribe, dicta o pega texto</span>
            </Card>
          </div>

          <div className="mt-4">
            <Card onClick={() => { setItems([]); setMode('EDITING'); }} className="flex items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-slate-400 bg-white cursor-pointer">
              <Plus className="w-5 h-5 text-slate-400 mr-2" />
              <span className="font-semibold text-slate-700">Crear Manualmente</span>
            </Card>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  if (mode === 'INITIAL' && activeRequest && activeRequest.status === RequestStatus.PENDING_QUOTES) {
    return <WaitingForQuotes activeRequest={activeRequest} onBack={onBack} onNavigate={onNavigate} userLocation={userLocation} />;
  }

  if (mode === 'TEXT_INPUT') {
    return (
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode('INITIAL')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Escribir Pedido</h2>
        </div>

        <Card className="p-0 overflow-hidden border-ferry-100">
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ej: Necesito 10 bultos de cemento gris, 5 varillas de 1/2 y 2 galones de pintura blanca..."
              className="w-full p-4 pr-14 h-48 outline-none resize-none text-slate-700 placeholder:text-slate-400"
            />
            <button
              onClick={toggleDictation}
              className={`absolute top-3 right-3 p-2.5 rounded-full transition-all ${isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                : 'bg-slate-100 text-slate-400 hover:bg-ferry-100 hover:text-ferry-600'
                }`}
              title={isListening ? 'Detener dictado' : 'Dictar por voz'}
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          {isListening && (
            <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-start gap-2 max-h-24 overflow-y-auto">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0 mt-1" />
              <span className="text-sm text-red-600 font-medium italic break-words flex-1 leading-tight">
                {interimText ? `"${interimText}"...` : 'Escuchando... habla ahora'}
              </span>
            </div>
          )}
          <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400 italic">Nuestra IA extraerá los materiales por ti</span>
            <Button
              onClick={handleTextExtraction}
              disabled={!textInput.trim() || isAnalyzing}
              className="px-6"
            >
              Procesar
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Sugerencias</h4>
          <div className="flex flex-wrap gap-2">
            {['10 bultos de cemento', '5 tubos PVC 1/2', 'Pintura blanca 5 galones', 'Caja de clavos 2"'].map(sug => (
              <button
                key={sug}
                onClick={() => setTextInput(sug)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:border-ferry-300 hover:text-ferry-600 transition-all"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'SCANNING') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-ferry-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-ferry-500 rounded-full border-t-transparent animate-spin"></div>
          <Camera className="absolute inset-0 m-auto w-10 h-10 text-ferry-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Analizando tu lista...</h3>
        <p className="text-slate-500 mt-2">Nuestra IA está leyendo tu letra de doctor.</p>
      </div>
    );
  }

  if (mode === 'EDITING') {
    // Quita la parte descriptiva entre paréntesis o después de " — ".
    // Primero elimina los (...) completos (con comas internas) y luego los " — texto",
    // para que "TIPO 2 — Estándar (semilavable, alcobas), BLANCO" → "TIPO 2, BLANCO".
    const stripHints = (val: string) =>
      val
        .replace(/\s*\([^)]*\)/g, '')   // elimina todos los (...) incluyendo comas internas
        .replace(/\s*—[^,]*/g, '')       // elimina " — texto" hasta la próxima coma
        .split(',')
        .map(p => p.trim())
        .filter(p => p)
        .join(', ');

    const getDisplayName = (item: MaterialItem) => {
      const nc = corregirNombreOCR((item.nombreComercial || item.name || '').replace(/\s*\(falta[^)]*\)/gi, '').trim());
      const mn = stripHints((item.medidaNominal || '').replace(/\s*\(falta[^)]*\)/gi, '').trim());
      const ca = stripHints((item.caracteristica || '').replace(/\s*\(falta[^)]*\)/gi, '').trim());
      const tipoCorr = item.tipoCorredera || '';
      let nombreConTipo = nc;
      if (tipoCorr && nc.toLowerCase().includes('corredera') && !nc.toUpperCase().includes(tipoCorr)) {
        nombreConTipo = nc.replace(/corredera/i, `CORREDERA ${tipoCorr}`);
      }
      // Si la medida es MOD + número, quitar el número suelto del nombre base
      const modMatch = mn.match(/^MOD(\d+)$/i);
      if (modMatch) {
        nombreConTipo = nombreConTipo.replace(new RegExp(`\\b${modMatch[1]}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
      }
      // Si la medida es número + unidad (ej: 40cm, 60nw), quitar el número suelto del nombre base
      const cmMatch = mn.match(/^(\d+)\s*(cm|nw|mm|pulgadas?|"|'')?$/i);
      if (cmMatch) {
        nombreConTipo = nombreConTipo.replace(new RegExp(`\\b${cmMatch[1]}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
      }
      // Filtrar partes que ya están en el nombre para no duplicar
      const ncUpper = nombreConTipo.toUpperCase();
      const mnFiltrado = mn && !mn.includes('falta') && !ncUpper.includes(mn.toUpperCase()) ? mn : null;

      // Solo mostrar características válidas para el config actual del producto
      const cfgDisplay = getConfigProducto(nc);
      const chipsValidos = cfgDisplay?.grupos.flatMap(g => g.opciones.map(o =>
        o.replace(/\s*\([^)]*\)/g, '').replace(/\s*—.*$/, '').trim().toUpperCase()
      ));
      const tieneEditable = cfgDisplay?.grupos.some(g => g.editable) ?? false;
      const caPartes = ca && !ca.includes('falta')
        ? ca.split(',').map(p => p.trim()).filter(p => {
            if (!p || ncUpper.includes(p.toUpperCase())) return false;
            if (!chipsValidos) return true;                          // sin config → mostrar todo
            if (chipsValidos.includes(p.toUpperCase())) return true; // chip válido del config actual
            if (tieneEditable) return true;                          // texto libre (color personalizado)
            return false;                                            // chip huérfano → ocultar
          }).join(', ') || null
        : null;
      return [nombreConTipo, mnFiltrado, caPartes]
        .filter(v => v && v.trim()).join(' - ').toUpperCase() || item.name;
    };

    return (
      <div>
        {/* Título de la solicitud — primera acción del usuario */}
        <div className="mb-4">
          <input
            type="text"
            value={quoteTitle}
            onChange={e => setQuoteTitle(e.target.value)}
            placeholder="¿Cómo se llama esta obra? (ej: Obra calle 80) — opcional"
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-ferry-300 focus:border-transparent shadow-sm"
            maxLength={80}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold">Revisar Lista</h2>
          </div>
          <Button variant="ghost" onClick={handleAddNewItem} className="!p-2">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {selectedCategory && (
          <div className="mb-4">
            <Badge type="info">Categoría: {selectedCategory}</Badge>
          </div>
        )}

        {/* Leyenda de indicadores */}
        <div className="flex items-center gap-4 mb-3 px-1 text-[11px]">
          <div className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-slate-500">Completo</span></div>
          <div className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-yellow-500" /><span className="text-slate-500">Revisar</span></div>
          <div className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-slate-500">Incompleto</span></div>
        </div>

        <div className="space-y-2 pb-4">
          {items.map((item, idx) => {
            const estado = getEstadoProducto(item);
            const mn = item.medidaNominal || '';
            const ca = item.caracteristica || '';
            return (
              <div
                key={idx}
                onClick={() => openEditModal(idx)}
                className="bg-white rounded-xl border border-slate-100 p-3 flex items-start gap-3 cursor-pointer hover:border-ferry-300 hover:shadow-sm transition-all"
              >
                {/* Indicador de semáforo */}
                <div className="flex-shrink-0 pt-0.5">
                  {estado.tipo === 'verde' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {estado.tipo === 'amarillo' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                  {estado.tipo === 'rojo' && <AlertCircle className="w-5 h-5 text-red-500" />}
                </div>

                {/* Info del producto */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-slate-800 leading-tight">
                    {getDisplayName(item) || <span className="text-slate-300 italic font-normal">Sin nombre</span>}
                  </p>
                  {/* Sub-indicadores: solo mostrar lo que FALTA (si ya está verde/completo, no mostrar nada) */}
                  {estado.tipo !== 'verde' && (() => {
                    const nombreLC = (item.nombreComercial || item.name || '').toLowerCase();
                    const nombreUC = (item.nombreComercial || item.name || '').toUpperCase();
                    const esBisagra = nombreLC.includes('bisagra');
                    const esCorredera = nombreLC.includes('corredera');
                    const tieneTipoBisagra = ['PARCHE', 'SEMIPARCHE', 'EMBEBIDA'].some(t => nombreUC.includes(t) || (ca && ca.toUpperCase().includes(t)));
                    const tieneCierre = ['CIERRE SUAVE', 'CIERRE NORMAL', 'PUSH'].some(c => nombreUC.includes(c) || (ca && ca.toUpperCase().includes(c)));

                    // Para productos genéricos: buscar label específico del config (ej: "color", "módulo")
                    const configItem = getConfigProducto(item.nombreComercial || item.name || '');
                    const camposFaltantes: { label: string; severity: 'red' | 'yellow' }[] = [];

                    if (configItem) {
                      for (const grupo of configItem.grupos) {
                        if (grupo.campo === 'medidaNominal') {
                          const val = (item.medidaNominal || '').trim();
                          if (!val || val.includes('falta')) camposFaltantes.push({ label: grupo.label.toLowerCase(), severity: 'red' });
                        } else if (grupo.campo === 'caracteristica') {
                          const val = (item.caracteristica || '').trim();
                          if (!val || val.includes('falta')) {
                            const yaEnNombre = grupo.opciones.some(op => nombreUC.includes(op.toUpperCase()));
                            if (!yaEnNombre) {
                              // Color → amarillo, funcional → rojo
                              const esColor = grupo.label.toLowerCase() === 'color';
                              camposFaltantes.push({ label: grupo.label.toLowerCase(), severity: esColor ? 'yellow' : 'red' });
                            }
                          }
                        } else if (grupo.campo === 'tipoCorredera' && esCorredera && !item.tipoCorredera) {
                          camposFaltantes.push({ label: 'tipo corredera', severity: 'red' });
                        }
                      }
                    } else {
                      // Producto no reconocido: avisos genéricos
                      if (mn && mn.includes('falta')) camposFaltantes.push({ label: 'medida', severity: 'red' });
                      if (ca && ca.includes('falta')) camposFaltantes.push({ label: 'característica', severity: 'yellow' });
                    }

                    // Bisagra: tipo montaje
                    if (esBisagra && !tieneTipoBisagra) camposFaltantes.push({ label: 'tipo bisagra', severity: 'red' });
                    // Bisagra/Corredera: tipo de cierre
                    if ((esBisagra || esCorredera) && !tieneCierre) camposFaltantes.push({ label: 'tipo de cierre', severity: 'red' });

                    if (camposFaltantes.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {camposFaltantes.map((f, i) => (
                          <span key={i} className={`text-[10px] flex items-center gap-0.5 ${f.severity === 'red' ? 'text-red-500' : 'text-yellow-500'}`}>
                            <AlertCircle className="w-2.5 h-2.5" />{f.label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Observación / nota del contratista */}
                  {item.observacion && (
                    <p className="text-[11px] text-blue-600 italic mt-1 flex items-start gap-1">
                      <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {item.observacion}
                    </p>
                  )}
                </div>

                {/* Cantidad + Unidad */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700">{item.quantity}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{item.unit}</p>
                </div>

                {/* Eliminar */}
                <button
                  onClick={(e) => { e.stopPropagation(); setItems(items.filter((_, i) => i !== idx)); }}
                  className="p-1 text-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-center text-slate-400 py-10">Agrega ítems para comenzar</p>
          )}
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          {/* Delivery address (required) — primero */}
          {!quoteSentSuccess && (
            <div>
              <div className="relative">
              <input
                ref={deliveryAddressInputRef}
                type="text"
                value={deliveryAddress}
                onChange={e => { setDeliveryAddress(e.target.value); localStorage.setItem('ferry_direccion_entrega', e.target.value); if (e.target.value.trim()) setAddressError(false); deliveryPlaces.search(e.target.value); }}
                onBlur={() => setTimeout(deliveryPlaces.clear, 200)}
                placeholder="Dirección exacta de entrega (Ej. Obra Calle 100 #15-20, Barrio X) *"
                className={`w-full text-sm px-4 py-2.5 rounded-xl border placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent shadow-sm ${
                  addressError
                    ? 'border-red-400 focus:ring-red-300 bg-red-50/80'
                    : 'border-slate-200 focus:ring-ferry-300 bg-white'
                }`}
                maxLength={120}
              />
              <PlaceSuggestionsDropdown
                predictions={deliveryPlaces.predictions}
                onPickPrediction={async prediction => {
                  const pick = await deliveryPlaces.select(prediction);
                  if (pick) applyDeliveryPick(pick);
                }}
              />
              </div>
              {addressError && (
                <p className="text-xs text-red-500 font-medium mt-1 pl-1">
                  La dirección de entrega es obligatoria.
                </p>
              )}
            </div>
          )}
          {/* GPS error banner */}
          {gpsError && !quoteSentSuccess && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-medium">
              <MapPin className="w-4 h-4 flex-shrink-0 text-red-500" />
              {gpsError}
            </div>
          )}
          {/* Submit button */}
          {quoteSentSuccess ? (
            <div className="flex items-center gap-3 bg-green-500 text-white px-5 py-4 rounded-2xl shadow-xl shadow-green-200 animate-in fade-in slide-in-from-bottom-3 duration-400">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">¡Lista enviada!</p>
                <p className="text-xs text-green-100">Los expertos cercanos te responderán pronto.</p>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => submitRequest()}
              disabled={items.length === 0 || isSendingQuote}
              className="w-full shadow-lg shadow-ferry-200"
            >
              {isSendingQuote ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Obteniendo ubicación...
                </span>
              ) : selectedCategory ? (
                `Cotizar con expertos en ${selectedCategory}`
              ) : (
                'Selecciona una especialidad ↓'
              )}
            </Button>
          )}
          {/* Activar tienda experta — debajo del botón */}
          {!quoteSentSuccess && (
            <div className={`border-t border-slate-100 pt-4 mt-1 pb-4 ${categoryError ? 'ring-2 ring-red-300 rounded-xl bg-red-50/60 px-2' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-bold text-slate-700">Activar tienda experta</h2>
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-ferry-500 font-semibold hover:underline"
                  >
                    Limpiar filtro
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">Filtra por categoría (obligatorio)</p>
              <div className="grid grid-cols-5 gap-2">
                {SPECIALTIES.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => { setSelectedCategory(selectedCategory === spec.id ? null : spec.id); setCategoryError(false); }}
                    className={`group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 ${selectedCategory === spec.id ? 'bg-ferry-50 ring-2 ring-ferry-500 scale-105 shadow-md' : 'bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-100 hover:shadow-lg'}`}
                  >
                    <div
                      className={`relative w-11 h-11 mb-2 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${selectedCategory === spec.id ? 'scale-110 -translate-y-1' : 'group-hover:scale-110 group-hover:-translate-y-1'} bg-gradient-to-br ${spec.bg}`}
                      style={{ boxShadow: 'inset 4px 4px 6px rgba(255,255,255,0.8), inset -4px -6px 8px rgba(0,0,0,0.15), 0 6px 10px -3px rgba(0,0,0,0.15), 0 3px 5px -2px rgba(0,0,0,0.05)' }}
                    >
                      <div className="absolute top-0.5 left-1.5 w-5 h-2.5 bg-white/70 rounded-full blur-[1px] rotate-[-25deg] transition-opacity duration-300 opacity-90 group-hover:opacity-100" />
                      <spec.icon
                        className={`w-5 h-5 relative z-10 opacity-90 transition-transform duration-300 group-hover:scale-110 ${spec.color}`}
                        style={{ filter: 'drop-shadow(0px 1px 1px rgba(255,255,255,0.8))' }}
                        strokeWidth={2.2}
                      />
                    </div>
                    <span className={`text-[10px] font-bold leading-tight text-center transition-colors ${selectedCategory === spec.id ? 'text-ferry-800' : 'text-slate-600 group-hover:text-slate-800'}`}>{spec.id}</span>
                  </button>
                ))}
              </div>
              {categoryError && (
                <p className="text-xs text-red-500 font-medium mt-2 pl-1">
                  Selecciona una especialidad antes de cotizar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* === MODAL: PRODUCTOS INCOMPLETOS === */}
        {showIncompleteModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowIncompleteModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Información incompleta</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  No podemos enviar la cotización. Los siguientes productos tienen información incompleta (marcados en rojo). Completa los detalles faltantes o elimínalos para continuar.
                </p>
                <ul className="w-full text-left space-y-1 mt-1">
                  {incompleteItems.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowIncompleteModal(false)}
                  className="mt-2 w-full bg-ferry-600 hover:bg-ferry-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Corregir lista
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === MODAL DE EDICIÓN DE PRODUCTO === */}
        {editingIndex !== null && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setEditingIndex(null)}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800">Editar Producto</h3>
                <button onClick={() => setEditingIndex(null)} className="p-1 hover:bg-slate-100 rounded-full">
                  <CloseIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Nombre comercial (read-only preview) */}
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre comercial</label>
              <input
                value={(() => {
                  let nb = editValues.nombreComercial || editValues.nombre || '';
                  const tipoSop = (editValues.tipoSoporte || '').trim();
                  if (tipoSop) nb = nb.replace(/soportes?/i, tipoSop);
                  const tipoCorr = (editValues.tipoCorredera || '').trim();
                  if (tipoCorr && nb.toLowerCase().includes('corredera') && !nb.toUpperCase().includes(tipoCorr)) {
                    nb = nb.replace(/corredera/i, `CORREDERA ${tipoCorr}`);
                  }
                  return [
                    nb,
                    (editValues.medidaNominal || '').replace(/\s*\(falta[^)]*\)/gi, '').trim(),
                    (editValues.caracteristica || '').replace(/\s*\(falta[^)]*\)/gi, '').trim(),
                  ].filter(v => v && v.trim()).join(' - ');
                })()}
                onChange={(e) => setEditValues({ ...editValues, nombreComercial: e.target.value })}
                className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 mt-1 mb-4 outline-none focus:ring-2 focus:ring-ferry-500"
                placeholder="Ej: BISAGRA PARCHE"
              />

              {/* Botones */}
              <div className="flex gap-3 mb-4">
                <button onClick={() => setEditingIndex(null)} className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-sm text-slate-600 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveEditModal} className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-sm text-white transition-colors">
                  Guardar ✓
                </button>
              </div>

              {/* Botones de sugerencia dinámicos */}
              {(() => {
                const nombreBase = editValues.nombreComercial || editValues.nombre || '';
                const tipoSoporteSel = editValues.tipoSoporte || '';
                let configNombre = nombreBase;
                if (tipoSoporteSel === 'SOPORTE ENTREPAÑO') configNombre = 'soporte entrepaño';
                if (tipoSoporteSel === 'SOPORTE TUBO') configNombre = 'soporte tubo';
                const config = getConfigProducto(configNombre);
                const gruposMedida = config?.grupos.filter(g => g.campo === 'medidaNominal') || [];
                const gruposCaracteristica = config?.grupos.filter(g => g.campo === 'caracteristica') || [];
                const gruposTipoSoporte = config?.grupos.filter(g => g.campo === 'tipoSoporte') || [];
                const gruposTipoCorredera = config?.grupos.filter(g => g.campo === 'tipoCorredera') || [];
                const esCorredera = nombreBase.toLowerCase().includes('corredera');
                const tipoCorredraSeleccionado = editValues.tipoCorredera || '';
                const subtiposCorredera = config?.subtipos || {};
                const subtipoActual = subtiposCorredera[tipoCorredraSeleccionado] || null;

                const renderChips = (opciones: string[], value: string, onChange: (v: string) => void, multi = false) => (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {opciones.map(op => {
                      const partes = value.replace(/\s*\(falta[^)]*\)/gi, '').split(',').map(p => p.trim().toUpperCase()).filter(p => p.length > 0);
                      const sel = multi ? partes.includes(op.toUpperCase()) : value.toUpperCase() === op.toUpperCase();
                      return (
                        <button
                          key={op}
                          onClick={() => {
                            if (multi) {
                              let parts = value.replace(/\s*\(falta[^)]*\)/gi, '').split(',').map(p => p.trim()).filter(p => p.length > 0);
                              if (sel) parts = parts.filter(p => p.toUpperCase() !== op.toUpperCase());
                              else {
                                opciones.forEach(o => { parts = parts.filter(p => p.toUpperCase() !== o.toUpperCase()); });
                                parts.push(op);
                              }
                              onChange(parts.join(', '));
                            } else {
                              onChange(sel ? '' : op);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${sel ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-200 text-red-500 hover:border-red-300'
                            }`}
                        >
                          {op}
                        </button>
                      );
                    })}
                  </div>
                );

                return (
                  <>
                    {/* Tipo de corredera */}
                    {esCorredera && gruposTipoCorredera.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{gruposTipoCorredera[0].label} *</label>
                        {renderChips(gruposTipoCorredera[0].opciones, tipoCorredraSeleccionado, (v) => setEditValues({ ...editValues, tipoCorredera: v, caracteristica: '' }))}
                      </div>
                    )}

                    {/* Cierre dinámico según tipo de corredera */}
                    {esCorredera && subtipoActual && subtipoActual.cierres.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Función de cierre</label>
                        {renderChips(subtipoActual.cierres, editValues.caracteristica, (v) => setEditValues({ ...editValues, caracteristica: v }), true)}
                      </div>
                    )}

                    {/* Color dinámico según tipo de corredera */}
                    {esCorredera && subtipoActual && subtipoActual.colores.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Color</label>
                        {renderChips(subtipoActual.colores, editValues.caracteristica, (v) => setEditValues({ ...editValues, caracteristica: v }), true)}
                      </div>
                    )}

                    {/* Tipo de soporte */}
                    {gruposTipoSoporte.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{gruposTipoSoporte[0].label}</label>
                        {renderChips(gruposTipoSoporte[0].opciones, tipoSoporteSel, (v) => setEditValues({ ...editValues, tipoSoporte: v, caracteristica: '', medidaNominal: '' }))}
                      </div>
                    )}

                    {/* Medida nominal */}
                    {gruposMedida.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Medida nominal</label>
                        {gruposMedida.map((grupo, gi) => (
                          <div key={gi}>
                            <span className="text-[10px] text-slate-400 font-medium">{grupo.label}</span>
                            <div className={`flex flex-wrap gap-1.5 mt-0.5 mb-2 ${grupo.scroll ? 'max-h-20 overflow-y-auto' : ''}`}>
                              {renderChips(grupo.opciones, editValues.medidaNominal, (v) => setEditValues({ ...editValues, medidaNominal: v }))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Característica (no correderas) */}
                    {!esCorredera && gruposCaracteristica.length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Característica</label>
                        {gruposCaracteristica.map((grupo, gi) => {
                          // Todas las opciones de todos los grupos de característica
                          const todasOpciones = gruposCaracteristica.flatMap(g => g.opciones.map(o => o.toUpperCase()));
                          // Partes actuales de la característica
                          const partesCa = editValues.caracteristica.split(',').map(p => p.trim()).filter(p => p);
                          // Valor libre: partes que no son un chip de ningún grupo
                          const valorLibre = partesCa.filter(p => !todasOpciones.includes(p.toUpperCase())).join(', ');
                          // ¿Algún chip de ESTE grupo está seleccionado?
                          const hayChipSeleccionado = partesCa.some(p => grupo.opciones.some(op => op.toUpperCase() === p.toUpperCase()));

                          return (
                            <div key={gi} className="mb-2">
                              <span className="text-[10px] text-slate-400 font-medium">{grupo.label}</span>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {renderChips(
                                  grupo.opciones,
                                  editValues.caracteristica,
                                  (v) => setEditValues({ ...editValues, caracteristica: v }),
                                  true  // multi=true: la selección compara por partes separadas por coma
                                )}
                              </div>
                              {grupo.editable && (
                                <input
                                  type="text"
                                  placeholder="Otro color... (ej: AZUL CIELO, TERRACOTA)"
                                  value={hayChipSeleccionado ? '' : valorLibre}
                                  onChange={e => {
                                    // Quitar chips de este grupo y el valor libre anterior; poner el nuevo valor libre
                                    let parts = partesCa.filter(p => !grupo.opciones.some(op => op.toUpperCase() === p.toUpperCase()));
                                    parts = parts.filter(p => todasOpciones.includes(p.toUpperCase())); // solo chips de otros grupos
                                    if (e.target.value) parts.push(e.target.value);
                                    setEditValues({ ...editValues, caracteristica: parts.join(', ') });
                                  }}
                                  className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-ferry-500 mt-1.5"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Cantidad</label>
                  <input value={editValues.cantidad} onChange={(e) => setEditValues({ ...editValues, cantidad: e.target.value })} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-ferry-500 mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Unidad</label>
                  <input value={editValues.unidad} onChange={(e) => setEditValues({ ...editValues, unidad: e.target.value })} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-ferry-500 mt-1" />
                </div>
              </div>

              {/* Observaciones */}
              <label className="text-xs font-semibold text-slate-500">Observaciones</label>
              <textarea
                value={editValues.observacion}
                onChange={(e) => setEditValues({ ...editValues, observacion: e.target.value })}
                placeholder="Ej: cemento marca CEMEX, pintura roja, tubo galvanizado..."
                className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-ferry-500 mt-1 mb-2 resize-none h-16"
              />

            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'QUOTES' && activeRequest) {
    const quotesCount = activeRequest.quotes.length;

    return (
      <div className="space-y-6 pb-20">
        <div className="bg-slate-900 text-white p-6 rounded-2xl -mt-2 relative">
          <button
            onClick={onBack}
            className="absolute top-6 left-4 p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="ml-8">
            <h2 className="text-2xl font-bold">¡Ofertas Listas!</h2>
            <p className="text-slate-400 text-sm">{quotesCount} ferreterías respondieron.</p>
          </div>
        </div>

        <div className="space-y-4">
          {activeRequest.quotes.length === 0 ? (
            <div className="text-center py-10 opacity-60">
              <Trash2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500">No hay cotizaciones activas.</p>
            </div>
          ) : (
            activeRequest.quotes.map((quote) => (
              <Card key={quote.id} className="border-l-4 border-l-ferry-500 relative overflow-hidden transition-all">
                {quote.totalPrice < 280000 && quote.itemsDetails?.every(i => i.status === 'AVAILABLE') && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">
                    MEJOR PRECIO
                  </div>
                )}

                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{quote.storeName}</h3>
                    <div className="flex items-center gap-2">
                      <StarRating rating={quote.rating} />
                      {activeRequest.category && activeRequest.category !== 'General' && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200">Esp. {activeRequest.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">${quote.totalPrice.toLocaleString()}</p>
                    {quote.includesTransport && <Badge type="success">Envío Gratis</Badge>}
                  </div>
                </div>

                <div className="flex gap-4 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg">
                  <div className="flex items-center gap-1">
                    {quote.itemsDetails?.every(i => i.status === 'AVAILABLE') ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    )}
                    {quote.availability}
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="w-4 h-4 text-blue-600" />
                    {quote.deliveryTime}
                  </div>
                </div>

                <div className="mb-4">
                  <button
                    onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)}
                    className="text-xs text-ferry-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    {expandedQuoteId === quote.id ? 'Ocultar Detalle' : 'Ver Detalle Cotizado'}
                    {expandedQuoteId === quote.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedQuoteId === quote.id && quote.itemsDetails && (
                    <div className="mt-3 bg-slate-50 rounded-lg p-2 text-sm space-y-2 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                      {quote.itemsDetails.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {item.status === 'AVAILABLE' ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <CloseIcon className="w-3 h-3 text-red-500" />
                            )}
                            <span className={`${item.status === 'MISSING' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {item.quantity} {item.unit} {item.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-slate-600">
                            {item.status === 'AVAILABLE' ? `$${(item.price || 0).toLocaleString()}` : 'Agotado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {onRejectQuote && (
                    <Button
                      variant="ghost"
                      onClick={() => onRejectQuote(activeRequest.id, quote.id)}
                      className="flex-1 text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100"
                    >
                      Rechazar
                    </Button>
                  )}
                  <Button onClick={() => handleInitiatePayment(quote)} className="flex-[2]">
                    Comprar
                  </Button>
                </div>
              </Card>
            )))}
        </div>
      </div>
    );
  }

  if (mode === 'PAYMENT' && selectedQuoteForPayment) {
    return (
      <div className="flex flex-col h-full bg-slate-50 -m-4 p-4 min-h-screen">
        <div className="flex items-center gap-2 mb-6 mt-2">
          <button onClick={handleBack} className="p-2 rounded-full bg-white shadow-sm hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-800">Pasarela de Pago</h2>
        </div>

        <Card className="mb-6 border-none shadow-md">
          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Proveedor</p>
              <h3 className="font-bold text-lg text-slate-800">{selectedQuoteForPayment.storeName}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total a Pagar</p>
              <h3 className="font-bold text-2xl text-ferry-600">${selectedQuoteForPayment.totalPrice.toLocaleString()}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Truck className="w-4 h-4 text-ferry-500" />
            <span>Entrega estimada: <strong>{selectedQuoteForPayment.deliveryTime}</strong></span>
          </div>
        </Card>

        <h3 className="font-bold text-slate-800 mb-3">Método de Pago</h3>

        <div className="space-y-3 mb-8">
          <div
            onClick={() => setPaymentMethod('NEQUI')}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'NEQUI' ? 'border-purple-600 bg-purple-50' : 'border-white bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-white">
                <span className="font-bold text-xs">Nequi</span>
              </div>
              <span className="font-semibold text-slate-700">Nequi</span>
            </div>
            {paymentMethod === 'NEQUI' && <div className="w-4 h-4 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-600"></div>}
          </div>

          <div
            onClick={() => setPaymentMethod('PSE')}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'PSE' ? 'border-blue-600 bg-blue-50' : 'border-white bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Banknote className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-700">PSE / Bancos</span>
            </div>
            {paymentMethod === 'PSE' && <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-600"></div>}
          </div>

          <div
            onClick={() => setPaymentMethod('CARD')}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'CARD' ? 'border-slate-800 bg-slate-100' : 'border-white bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-700">Tarjeta Crédito/Débito</span>
            </div>
            {paymentMethod === 'CARD' && <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-white ring-2 ring-slate-800"></div>}
          </div>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
            <Lock className="w-3 h-3" />
            Pagos procesados y protegidos por Ferry
          </div>
          <Button
            onClick={handleConfirmPayment}
            isLoading={isProcessingPayment}
            className={`w-full text-lg py-4 ${paymentMethod === 'NEQUI' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200' : ''}`}
          >
            Pagar ${selectedQuoteForPayment.totalPrice.toLocaleString()}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'TRACKING' && activeRequest) {
    const activeQuote = getActiveQuote();

    return (
      <div className="relative h-[calc(100vh-140px)] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={onBack}
            className="bg-white p-3 rounded-full shadow-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute inset-0 opacity-40 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-74.0817,4.6097,14,0/600x600?access_token=Pk.mock')] bg-cover grayscale"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), repeating-linear-gradient(45deg, #e5e7eb 25%, #f3f4f6 25%, #f3f4f6 75%, #e5e7eb 75%, #e5e7eb)` }}
        ></div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <path d="M 120 150 Q 200 300 250 400" stroke="#f97316" strokeWidth="4" fill="none" strokeDasharray="8 4" className="animate-[dash_1s_linear_infinite]" />
            </svg>
            <style>{`@keyframes dash { to { stroke-dashoffset: -12; } }`}</style>

            <div className="absolute top-[140px] left-[110px] bg-white p-2 rounded-full shadow-lg z-10 animate-bounce">
              <Truck className="w-6 h-6 text-ferry-600" />
            </div>

            <div className="absolute bottom-[200px] right-[80px] bg-slate-800 p-2 rounded-full shadow-lg z-10">
              <MapPin className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 bg-white p-4 rounded-xl shadow-2xl border-t border-slate-100">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
              <img src="https://picsum.photos/100/100" alt="Driver" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">Camión de {activeQuote?.storeName.split(' ')[0]}</h4>
              <p className="text-sm text-slate-500">Llega en 12 min</p>
            </div>
            <div className="text-right">
              <span className="block font-mono bg-slate-100 px-2 py-1 rounded text-xs">PLA-392</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" variant="outline">Llamar</Button>
            <Button className="flex-1" onClick={() => setMode('RATING')}>Confirmar Entrega</Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'RATING' && activeRequest) {
    const activeQuote = getActiveQuote();

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800">¡Pedido Completado!</h2>
          <p className="text-slate-500 mt-2">¿Cómo estuvo el servicio de <span className="font-semibold text-slate-700">{activeQuote?.storeName}</span>?</p>
        </div>

        <div className="flex gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setUserRating(star)}
              className="focus:outline-none transform hover:scale-110 transition-transform"
            >
              <Star
                className={`w-10 h-10 ${star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`}
              />
            </button>
          ))}
        </div>

        <textarea
          placeholder="Escribe un comentario (opcional)..."
          className="w-full p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-ferry-500 outline-none resize-none h-32"
        ></textarea>

        <Button
          onClick={() => onFinishOrder(activeRequest.id, userRating)}
          disabled={userRating === 0}
          className="w-full"
        >
          Enviar Calificación
        </Button>

        <Button variant="ghost" onClick={() => onFinishOrder(activeRequest.id, 0)} className="w-full text-slate-400">
          Omitir
        </Button>
      </div>
    );
  }

  return null;
};
