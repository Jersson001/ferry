
import React from 'react';
import { MaterialRequest, RequestStatus, Product } from '../types';
import { Card, Badge, Button, StarRating } from '../components/UIComponents';
import { ShoppingBag, Briefcase, Store, TrendingUp, Percent, MapPin, Loader2, Map } from 'lucide-react';


// =============================================
// 🔑 GOOGLE MAPS API KEY
// Reemplaza este string con tu API Key de Google Cloud
// (debe tener habilitadas Maps JavaScript API y Maps Embed API)
// =============================================
const GOOGLE_MAPS_API_KEY = 'AIzaSyCMYETfHamhW726Bz2l9pXCLTbEv1EkzQM';

interface Props {
  userName: string;
  ongoingRequest?: MaterialRequest;
  products: Product[];
  onNavigate: (view: 'SHOP' | 'HUB') => void;
  onOpenRequest: (reqId: string) => void;
  userLocation?: { lat: number, lng: number } | null;
  calcularDistancia?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const TOP_STORES = [
  { id: 's1', name: 'Ferretería El Tornillo', rating: 4.8, image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=100', category: 'General', lat: 4.6110, lng: -74.0830 },
  { id: 's2', name: 'Mundo Fontanero', rating: 4.9, image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=100', category: 'Plomería', lat: 4.6250, lng: -74.0650 },
  { id: 's3', name: 'Depósito Central', rating: 4.5, image: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&q=80&w=100', category: 'Obra Civil', lat: 4.6350, lng: -74.0750 },
];

const PROMO_PRODUCTS: Product[] = [
  {
    id: 'promo1',
    storeId: 's1',
    name: 'Kit Herrajes Gabinete',
    price: 45000,
    stock: 20,
    category: 'Carpintería',
    description: 'Juego completo de bisagras y manijas.',
    image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=200',
    lat: 4.6110, lng: -74.0830
  },
  {
    id: 'promo2',
    storeId: 's2',
    name: 'Taladro 20V + Set',
    price: 180000,
    stock: 5,
    category: 'Herramientas',
    description: 'Potente taladro inalámbrico.',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=200',
    lat: 4.6250, lng: -74.0650
  }
];

// --- COMPONENTE DE MAPA ---
const MapSection: React.FC<{
  userLocation: { lat: number, lng: number } | null | undefined;
  products: (Product & { distance: number | null })[];
}> = ({ userLocation, products }) => {

  // Estado de carga: no hay ubicación aún
  if (!userLocation) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Map className="w-4 h-4 text-ferry-600" />
          <h3 className="font-bold text-slate-800 text-sm">Tiendas cerca de ti</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <div className="relative mb-4">
            <div className="w-14 h-14 rounded-full bg-ferry-50 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-ferry-500 animate-spin" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-ferry-100 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-ferry-600" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Obteniendo tu ubicación...</p>
          <p className="text-xs text-slate-400 max-w-[220px]">
            Permite el acceso a tu ubicación para ver ferreterías cercanas en el mapa
          </p>
        </div>
      </div>
    );
  }

  // Construir markers URL para Google Maps Embed
  const markersQuery = products
    .filter(p => p.lat != null && p.lng != null)
    .map(p => `markers=color:orange%7Clabel:F%7C${p.lat},${p.lng}`)
    .join('&');

  // URL del mapa con la API Key real
  const mapSrc = `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_API_KEY}&center=${userLocation.lat},${userLocation.lng}&zoom=13`;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-ferry-600" />
          <h3 className="font-bold text-slate-800 text-sm">Tiendas cerca de ti</h3>
        </div>
        <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] text-green-700 font-semibold">GPS activo</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="relative h-44 mx-3 mb-3 rounded-xl overflow-hidden border border-slate-100">
        <iframe
          src={mapSrc}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          title="Mapa de ferreterías cercanas"
        />
        {/* Overlay con coordenadas */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-md font-mono">
          📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
        </div>
        {/* Radio indicator */}
        <div className="absolute bottom-2 right-2 bg-ferry-500/90 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-md font-semibold">
          Radio: 50 km
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<Props> = ({ userName, ongoingRequest, products, onNavigate, onOpenRequest, userLocation, calcularDistancia }) => {
  // --- FILTRO DE GEOLOCALIZACIÓN (Estilo Tinder - 50km) ---
  const allProducts = [...PROMO_PRODUCTS, ...products.slice(0, 2)];

  // Calcula distancia para cada producto y filtra por 50km si hay ubicación
  const displayProducts = allProducts.map(product => {
    let distance: number | null = null;
    if (userLocation && calcularDistancia && product.lat != null && product.lng != null) {
      distance = calcularDistancia(userLocation.lat, userLocation.lng, product.lat, product.lng);
    }
    return { ...product, distance };
  }).filter(product => {
    // Si no hay ubicación o el producto no tiene coordenadas, mostrar siempre
    if (!userLocation || !calcularDistancia || product.lat == null || product.lng == null) return true;
    // Filtro Tinder: solo productos dentro de 50km
    return product.distance !== null && product.distance <= 50;
  });

  // Filtrar tiendas top por distancia también
  const displayStores = TOP_STORES.map(store => {
    let distance: number | null = null;
    if (userLocation && calcularDistancia && store.lat != null && store.lng != null) {
      distance = calcularDistancia(userLocation.lat, userLocation.lng, store.lat, store.lng);
    }
    return { ...store, distance };
  }).filter(store => {
    if (!userLocation || !calcularDistancia) return true;
    return store.distance !== null && store.distance <= 50;
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
        {/* Abstract Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-ferry-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
      </div>

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
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
          <TrendingUp className="w-5 h-5 text-slate-400" />
          <span className="text-sm">¡Es un buen día para remodelar!</span>
        </div>
      )}


      {/* 🗺 Sección de Mapa de Google */}
      <MapSection userLocation={userLocation} products={displayProducts} />

      {/* Top Rated Stores */}
      <div>
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-4 h-4 text-ferry-600" /> Tiendas Top
          </h3>
          <span className="text-xs text-ferry-600 font-semibold cursor-pointer">Ver todas</span>
        </div>
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
              {/* Badge de distancia para tiendas */}
              {store.distance !== null && (
                <div className="flex items-center gap-0.5 mt-1.5 text-[9px] text-slate-400 font-medium">
                  <MapPin className="w-2.5 h-2.5 text-ferry-400" />
                  {store.distance < 1 ? `${(store.distance * 1000).toFixed(0)}m` : `a ${store.distance.toFixed(1)} km`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Promotions (Herrajes y más) */}
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
                {/* Badge de distancia */}
                {product.distance !== null && (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-sm flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-ferry-500" />
                    {product.distance < 1 ? `${(product.distance * 1000).toFixed(0)}m` : `${product.distance.toFixed(1)} km`}
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
