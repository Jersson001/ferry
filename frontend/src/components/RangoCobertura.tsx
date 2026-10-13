import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getCoberturaTiendas } from '../services/quoteService';

interface Props {
  radioKm: number;
  onChange: (km: number) => void;
  categoria: string | null;
  ubicacion: { lat: number; lng: number } | null;
}

export const RADIO_MIN_KM = 2;
export const RADIO_MAX_KM = 50;

// El cliente decide hasta dónde quiere que le coticen; debajo ve cuántas ferreterías alcanza con ese radio.
export const RangoCobertura: React.FC<Props> = ({ radioKm, onChange, categoria, ubicacion }) => {
  const [cantidad, setCantidad] = useState<number | null>(null);

  useEffect(() => {
    if (!categoria) { setCantidad(null); return; }
    let vigente = true;
    // Espera a que deje de mover el deslizador para no pedir la cuenta en cada paso.
    const t = setTimeout(() => {
      getCoberturaTiendas(categoria, ubicacion, radioKm).then(n => { if (vigente) setCantidad(n); });
    }, 250);
    return () => { vigente = false; clearTimeout(t); };
  }, [categoria, ubicacion?.lat, ubicacion?.lng, radioKm]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-ferry-600" /> Hasta dónde quieres cotizaciones
        </p>
        <span className="text-sm font-extrabold text-ferry-700">{radioKm} km</span>
      </div>
      <input
        type="range"
        min={RADIO_MIN_KM}
        max={RADIO_MAX_KM}
        step={1}
        value={radioKm}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="Radio de cobertura en kilómetros"
        className="w-full mt-2 accent-ferry-600"
      />
      <p className="text-xs text-slate-500 mt-1">
        {!categoria
          ? 'Elige una especialidad para ver cuántas ferreterías te alcanzan.'
          : cantidad === null
            ? 'Contando ferreterías…'
            : cantidad === 0
              ? 'Ninguna ferretería llega con este rango: amplíalo.'
              : `${cantidad} ${cantidad === 1 ? 'ferretería te puede cotizar' : 'ferreterías te pueden cotizar'}. Recibes hasta 5 cotizaciones.`}
      </p>
    </div>
  );
};
