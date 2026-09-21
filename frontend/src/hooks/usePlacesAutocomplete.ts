import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

/** Lo que devuelve la selección de una sugerencia: dirección y coordenadas. */
export interface PlacePick {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Autocompletado de direcciones con Places API (New).
 *
 * Reemplaza a `google.maps.places.Autocomplete`, que es la API *legacy*:
 * Google dejó de ofrecerla a proyectos nuevos en marzo de 2025 y en ellos
 * falla con `LegacyApiNotActivatedMapError`.
 *
 * A diferencia del widget legacy, esta API no dibuja nada: devuelve las
 * sugerencias y cada vista las muestra con `PlaceSuggestionsDropdown`, así
 * que la lista respeta el diseño de Ferry.
 */
export function usePlacesAutocomplete({ debounceMs = 300, minChars = 3 } = {}) {
  const placesLib = useMapsLibrary('places');
  const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([]);

  // Un token por sesión de búsqueda: desde que el usuario empieza a escribir
  // hasta que elige una dirección. Google cobra la sesión como una sola
  // unidad; sin token, cada tecla se factura aparte.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Cada búsqueda lleva un número; si llega la respuesta de una búsqueda
  // anterior después de una más nueva, se descarta para no pisar resultados.
  const requestIdRef = useRef(0);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    requestIdRef.current++;
    setPredictions([]);
  }, []);

  const search = useCallback(
    (text: string) => {
      clearTimeout(timerRef.current);
      if (!placesLib || text.trim().length < minChars) {
        requestIdRef.current++;
        setPredictions([]);
        return;
      }

      timerRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        sessionTokenRef.current ??= new placesLib.AutocompleteSessionToken();
        try {
          const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: text,
            includedRegionCodes: ['co'],
            region: 'co',
            language: 'es',
            sessionToken: sessionTokenRef.current,
          });
          if (requestId !== requestIdRef.current) return;
          setPredictions(
            suggestions
              .map((s) => s.placePrediction)
              .filter((p): p is google.maps.places.PlacePrediction => p !== null),
          );
        } catch (error) {
          if (requestId === requestIdRef.current) setPredictions([]);
          console.error('[Places] Error al buscar sugerencias:', error);
        }
      }, debounceMs);
    },
    [placesLib, minChars, debounceMs],
  );

  const select = useCallback(
    async (prediction: google.maps.places.PlacePrediction): Promise<PlacePick | null> => {
      clear();
      try {
        const place = prediction.toPlace();
        // Esta llamada cierra la sesión de facturación: la siguiente búsqueda
        // necesita un token nuevo.
        await place.fetchFields({ fields: ['formattedAddress', 'location'] });
        sessionTokenRef.current = null;
        if (!place.formattedAddress || !place.location) return null;
        return {
          address: place.formattedAddress,
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
      } catch (error) {
        console.error('[Places] Error al obtener la dirección elegida:', error);
        return null;
      }
    },
    [clear],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { predictions, search, select, clear };
}
