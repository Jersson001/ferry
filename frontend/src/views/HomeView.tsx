
import React, { useState, useEffect } from 'react';
import { MaterialRequest, RequestStatus, Product, UserProfile } from '../types';
import { Badge, Button, StarRating } from '../components/UIComponents';
import { ShoppingBag, Briefcase, Store, TrendingUp, Percent, MapPin, FileText, Package, ChevronRight, UserCog, ArrowRight } from 'lucide-react';
import { getRecentPendingQuotes, RecentPendingQuote } from '../services/quoteService';

// Formato unificado de tienda para mostrar en UI
type StoreDisplay = {
  id: string;
  name: string;
  rating: number;
  image: string;
  category: string;
  lat: number;
  lng: number;
  distance: number | null;
};

// Imágenes de respaldo para tiendas sin foto
const STORE_IMAGES = [
  'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=100',
  'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&q=80&w=100',
];

// Fallback estático si no se pasa stores
const TOP_STORES_STATIC: Omit<StoreDisplay, 'distance'>[] = [
  { id: 's1', name: 'Ferretería El Tornillo',   rating: 4.8, image: STORE_IMAGES[0], category: 'Depósito',    lat: 4.6097, lng: -74.0817 },
  { id: 's2', name: 'Mundo Fontanero',          rating: 4.9, image: STORE_IMAGES[1], category: 'Plomería',    lat: 4.6250, lng: -74.0650 },
  { id: 's3', name: 'Eléctricos del Norte',     rating: 4.6, image: STORE_IMAGES[2], category: 'Eléctricos',  lat: 4.7110, lng: -74.0721 },
  { id: 's4', name: 'Carpintería La Madera',    rating: 4.7, image: STORE_IMAGES[3], category: 'Carpintería', lat: 4.6800, lng: -74.1100 },
  { id: 's5', name: 'Aceros Estructurales SAS', rating: 4.4, image: STORE_IMAGES[4], category: 'Estructural', lat: 4.6300, lng: -74.1300 },
  { id: 's6', name: 'Pinturas y Color SAS',     rating: 4.5, image: STORE_IMAGES[5], category: 'Pintura',     lat: 4.6700, lng: -74.0850 },
];

const PROMO_PRODUCTS: Product[] = [
  {
    id: 'promo1', storeId: 's1', name: 'Kit Herrajes Gabinete', price: 45000, stock: 20,
    category: 'Carpintería', description: 'Juego completo de bisagras y manijas.',
    image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=200',
    lat: 4.6097, lng: -74.0817,
  },
  {
    id: 'promo2', storeId: 's2', name: 'Taladro 20V + Set', price: 180000, stock: 5,
    category: 'Herramientas', description: 'Potente taladro inalámbrico.',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=200',
    lat: 4.6250, lng: -74.0650,
  },
];


// ---------------------------------------------------------------------------
// Notification feed hook
// ---------------------------------------------------------------------------

const useRecentQuotes = () => {
  const [quotes, setQuotes] = useState<RecentPendingQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRecentPendingQuotes(3)
      .then(data => { if (!cancelled) setQuotes(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { quotes, loading };
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
  products: Product[];
  stores?: UserProfile[];
  onNavigate: (view: 'SHOP' | 'HUB' | 'QUOTES') => void;
  onOpenRequest: (reqId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  calcularDistancia?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  isGuest?: boolean;
  onRegister?: (role: 'constructor' | 'ferreteria') => void;
}

export const HomeView: React.FC<Props> = ({
  userName, ongoingRequest, products, stores, onNavigate, onOpenRequest, userLocation, calcularDistancia, isGuest = false, onRegister,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { quotes: recentQuotes, loading: quotesLoading } = useRecentQuotes();

  // --- Normalizar tiendas a formato unificado ---
  const allStores: Omit<StoreDisplay, 'distance'>[] = stores?.length
    ? stores
        .filter(s => s.location?.lat != null && s.location?.lng != null)
        .map((s, idx) => ({
          id: s.uid,
          name: s.displayName || 'Ferretería',
          rating: 4.5,
          image: s.photoURL || STORE_IMAGES[idx % STORE_IMAGES.length],
          category: s.specialties?.[0] || 'General',
          lat: s.location!.lat,
          lng: s.location!.lng,
        }))
    : TOP_STORES_STATIC;

  // Categorías únicas para los filtros pill
  const categories = ['Todos', ...Array.from(new Set(allStores.map(s => s.category)))];

  // Calcular distancia y aplicar filtros (radio 50km + categoría)
  const displayStores: StoreDisplay[] = allStores
    .map(store => {
      const distance =
        userLocation && calcularDistancia
          ? calcularDistancia(userLocation.lat, userLocation.lng, store.lat, store.lng)
          : null;
      return { ...store, distance };
    })
    .filter(store => {
      if (userLocation && calcularDistancia && store.distance !== null && store.distance > 50) return false;
      if (selectedCategory && store.category !== selectedCategory) return false;
      return true;
    });

  // --- Productos con filtro de distancia ---
  const allProducts = [...PROMO_PRODUCTS, ...products.slice(0, 2)];
  const displayProducts = allProducts
    .map(product => {
      const distance =
        userLocation && calcularDistancia && product.lat != null && product.lng != null
          ? calcularDistancia(userLocation.lat, userLocation.lng, product.lat, product.lng)
          : null;
      return { ...product, distance };
    })
    .filter(product => {
      if (!userLocation || !calcularDistancia || product.lat == null || product.lng == null) return true;
      return product.distance !== null && product.distance <= 50;
    });

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
            <button
              onClick={() => onNavigate('HUB')}
              className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-sm transition-all"
            >
              <Briefcase className="w-4 h-4" /> Servicios
            </button>
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
                <button
                  key={q.id}
                  onClick={() => onNavigate('QUOTES')}
                  className={`w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] ${isPartial ? 'border-l-4 border-l-orange-500' : ''}`}
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
              );
            })
          )}
        </div>
      )}

      {/* Tiendas Cercanas con filtro de categoría */}
      <div>
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-4 h-4 text-ferry-600" /> Tiendas Top
          </h3>
          <span className="text-xs text-ferry-600 font-semibold cursor-pointer">Ver todas</span>
        </div>

        {/* Filtros de categoría */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'Todos' ? null : cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                (cat === 'Todos' && !selectedCategory) || cat === selectedCategory
                  ? 'bg-ferry-600 border-ferry-600 text-white shadow-sm shadow-ferry-200'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-ferry-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lista de tiendas */}
        {displayStores.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No hay tiendas de <strong>{selectedCategory}</strong> en un radio de 50 km
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {displayStores.map(store => (
              <div key={store.id} className="min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 mb-2 overflow-hidden">
                  <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-xs text-slate-800 mb-1 line-clamp-1">{store.name}</h4>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-600">{store.rating}</span>
                  <div className="flex text-yellow-400 text-[8px]"><StarRating rating={5} /></div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{store.category}</span>
                {store.distance !== null && (
                  <div className="flex items-center gap-0.5 mt-1.5 text-[9px] text-ferry-600 font-semibold">
                    <MapPin className="w-2.5 h-2.5" />
                    {store.distance < 1
                      ? `${(store.distance * 1000).toFixed(0)} m`
                      : `a ${store.distance.toFixed(1)} km`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ofertas Flash */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-4 h-4 text-ferry-600" /> Ofertas Flash
          </h3>
          <Badge type="warning">Herrajes</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {displayProducts.map((product, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-28 bg-slate-100 relative">
                <img src={product.image} className="w-full h-full object-cover" alt={product.name} />
                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                  -{(idx + 2) * 10}%
                </div>
                {product.distance !== null && (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-sm flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-ferry-500" />
                    {product.distance < 1 ? `${(product.distance * 1000).toFixed(0)} m` : `${product.distance.toFixed(1)} km`}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-bold text-xs text-slate-700 line-clamp-2 mb-1">{product.name}</h4>
                <div className="flex items-end gap-2">
                  <span className="font-bold text-ferry-600">${product.price.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 line-through decoration-red-400">${(product.price * 1.2).toLocaleString()}</span>
                </div>
                <Button variant="outline" className="w-full mt-2 !py-1 !px-2 !text-xs h-7">
                  Agregar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
