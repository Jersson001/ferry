import React from 'react';
import { MapPin, History } from 'lucide-react';

interface Props {
  /** Sugerencias de Google, de `usePlacesAutocomplete`. */
  predictions: google.maps.places.PlacePrediction[];
  onPickPrediction: (prediction: google.maps.places.PlacePrediction) => void;
  /** Direcciones que el usuario ya usó antes. Opcional; van primero. */
  saved?: string[];
  onPickSaved?: (address: string) => void;
}

/**
 * Lista desplegable bajo un campo de dirección. Va dentro de un contenedor
 * con `position: relative`.
 *
 * Los botones usan onMouseDown con preventDefault: así el campo no pierde el
 * foco al elegir, y su onBlur no alcanza a actuar antes que la selección.
 */
export const PlaceSuggestionsDropdown: React.FC<Props> = ({
  predictions,
  onPickPrediction,
  saved = [],
  onPickSaved,
}) => {
  if (predictions.length === 0 && saved.length === 0) return null;

  const itemClass =
    'w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-b-0 text-sm text-slate-700 flex items-center gap-2 transition-colors';

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
      {saved.map((address) => (
        <button
          key={`saved-${address}`}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPickSaved?.(address);
          }}
          className={itemClass}
        >
          <History className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{address}</span>
        </button>
      ))}

      {predictions.map((prediction) => {
        const main = prediction.mainText?.toString() ?? prediction.text.toString();
        const secondary = prediction.secondaryText?.toString();
        return (
          <button
            key={prediction.placeId}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPickPrediction(prediction);
            }}
            className={itemClass}
          >
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">
              <span className="font-semibold text-slate-800">{main}</span>
              {secondary && <span className="text-slate-400"> {secondary}</span>}
            </span>
          </button>
        );
      })}

      {/* Google exige atribución cuando se muestran sus sugerencias sin un mapa. */}
      {predictions.length > 0 && (
        <div className="px-4 py-1.5 text-right text-[10px] text-slate-400">powered by Google</div>
      )}
    </div>
  );
};
