import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Store } from 'lucide-react';
import { StarRating } from './UIComponents';
import { getTopRatedStores, TopStore } from '../services/quoteService';

interface Props {
  userLocation?: { lat: number; lng: number } | null;
  calcularDistancia?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

type TiendaCalificada = TopStore & { category: string; distance: number | null };

const MAX_EN_INICIO = 10;
const RADIO_KM = 50;

const textoDistancia = (km: number) => (km < 1 ? `${(km * 1000).toFixed(0)} m` : `a ${km.toFixed(1)} km`);

const textoCalificaciones = (n: number) => `${n} ${n === 1 ? 'calificación' : 'calificaciones'}`;

const Avatar: React.FC<{ store: TopStore; className: string }> = ({ store, className }) =>
  store.photoUrl ? (
    <img src={store.photoUrl} alt={store.name} className={`${className} object-cover bg-slate-100`} />
  ) : (
    <div className={`${className} bg-ferry-100 text-ferry-700 font-bold flex items-center justify-center`}>
      {store.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );

export const TopStoresSection: React.FC<Props> = ({ userLocation, calcularDistancia }) => {
  const [stores, setStores] = useState<TopStore[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTopRatedStores(50).then(data => { if (!cancelled) setStores(data); });
    return () => { cancelled = true; };
  }, []);

  // Sin calificaciones todavía no hay nada que mostrar: es mejor ocultar la sección que inventarla
  if (stores.length === 0) return null;

  const calificadas: TiendaCalificada[] = stores.map(s => ({
    ...s,
    category: s.specialties[0] || 'General',
    distance:
      userLocation && calcularDistancia && s.location
        ? calcularDistancia(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng)
        : null,
  }));

  const categories = ['Todos', ...Array.from(new Set(calificadas.map(s => s.category)))];

  const enInicio = calificadas
    .filter(s => (s.distance === null || s.distance <= RADIO_KM) && (!selectedCategory || s.category === selectedCategory))
    .slice(0, MAX_EN_INICIO);

  return (
    <div>
      <div className="flex justify-between items-end mb-3 px-1">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Store className="w-4 h-4 text-ferry-600" /> Mejor calificadas
        </h3>
        <button onClick={() => setShowAll(true)} className="text-xs text-ferry-600 font-semibold">
          Ver todas
        </button>
      </div>

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

      {enInicio.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No hay tiendas de <strong>{selectedCategory}</strong> en un radio de {RADIO_KM} km
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {enInicio.map(store => (
            <div key={store.id} className="min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <Avatar store={store} className="w-12 h-12 rounded-full mb-2 overflow-hidden" />
              <h4 className="font-bold text-xs text-slate-800 mb-1 line-clamp-1">{store.name}</h4>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-bold text-slate-600">{store.rating.toFixed(1)}</span>
                <div className="flex text-yellow-400 text-[8px]"><StarRating rating={Math.round(store.rating)} /></div>
                <span className="text-[9px] text-slate-400">({store.reviews})</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{store.category}</span>
              {store.distance !== null && (
                <div className="flex items-center gap-0.5 mt-1.5 text-[9px] text-ferry-600 font-semibold">
                  <MapPin className="w-2.5 h-2.5" />
                  {textoDistancia(store.distance)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAll && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
          <div className="max-w-md mx-auto min-h-full pb-10">
            <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <button
                onClick={() => setShowAll(false)}
                aria-label="Volver"
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-slate-800">Ferreterías mejor calificadas</h2>
            </div>

            <ol className="px-4 pt-4 space-y-3">
              {calificadas.map((store, i) => (
                <li key={store.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <Avatar store={store} className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{store.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex text-yellow-400 text-xs"><StarRating rating={Math.round(store.rating)} /></div>
                      <span className="text-xs font-bold text-slate-600">{store.rating.toFixed(1)}</span>
                      <span className="text-[11px] text-slate-400">· {textoCalificaciones(store.reviews)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {(store.specialties.length > 0 ? store.specialties : ['General']).map(spec => (
                        <span key={spec} className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">{spec}</span>
                      ))}
                      {store.distance !== null && (
                        <span className="flex items-center gap-0.5 text-[10px] text-ferry-600 font-semibold">
                          <MapPin className="w-2.5 h-2.5" />
                          {textoDistancia(store.distance)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
