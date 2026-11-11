import React, { useEffect, useState } from 'react';
import { MapPin, Percent, Package } from 'lucide-react';
import { getPromociones, Promocion } from '../services/quoteService';

interface Props {
  userLocation?: { lat: number; lng: number } | null;
  calcularDistancia?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const RADIO_KM = 50;
const MAX_EN_INICIO = 12;

const textoDistancia = (km: number) => (km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`);
const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;

// Promociones reales: productos que cada ferretería marcó "en oferta" en su catálogo.
// Se filtran por la especialidad de la tienda que las publica. Sin promociones, la sección no se muestra.
export const PromocionesSection: React.FC<Props> = ({ userLocation, calcularDistancia }) => {
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [especialidad, setEspecialidad] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPromociones(100).then(data => { if (!cancelled) setPromos(data); });
    return () => { cancelled = true; };
  }, []);

  if (promos.length === 0) return null;

  const conDistancia = promos
    .map(p => ({
      ...p,
      distance:
        userLocation && calcularDistancia && p.location
          ? calcularDistancia(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng)
          : null,
    }))
    .filter(p => p.distance === null || p.distance <= RADIO_KM);

  if (conDistancia.length === 0) return null;

  const especialidadesDe = (p: Promocion) => (p.specialties.length > 0 ? p.specialties : ['General']);
  const chips = ['Todas', ...Array.from(new Set(conDistancia.flatMap(especialidadesDe)))];

  const visibles = conDistancia
    .filter(p => !especialidad || especialidadesDe(p).includes(especialidad))
    .slice(0, MAX_EN_INICIO);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Percent className="w-4 h-4 text-ferry-600" /> Promociones
        </h3>
      </div>

      {chips.length > 2 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => setEspecialidad(chip === 'Todas' ? null : chip)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                (chip === 'Todas' && !especialidad) || chip === especialidad
                  ? 'bg-ferry-600 border-ferry-600 text-white shadow-sm shadow-ferry-200'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-ferry-300'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visibles.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="h-28 bg-slate-100 relative flex items-center justify-center">
              {p.image ? (
                <img src={p.image} className="w-full h-full object-cover" alt={p.name} loading="lazy" />
              ) : (
                <Package className="w-8 h-8 text-slate-300" />
              )}
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                -{p.discountPercent}%
              </div>
              {p.distance !== null && (
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-sm flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 text-ferry-500" />
                  {textoDistancia(p.distance)}
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="font-bold text-xs text-slate-700 line-clamp-2 mb-1">{p.name}</h4>
              <div className="flex items-end gap-2">
                <span className="font-bold text-ferry-600">{pesos(p.finalPrice)}</span>
                <span className="text-[10px] text-slate-400 line-through decoration-red-400">{pesos(p.price)}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{p.storeName}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
