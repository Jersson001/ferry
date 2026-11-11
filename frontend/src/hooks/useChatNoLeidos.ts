import { useEffect, useState } from 'react';
import { getNoLeidos } from '../services/chatService';

// Un solo sondeo compartido por todas las tarjetas que muestran el contador de mensajes sin leer.
let actual: Record<string, number> = {};
const oyentes = new Set<(v: Record<string, number>) => void>();
let intervalo: ReturnType<typeof setInterval> | null = null;

export const refrescarNoLeidos = async () => {
  actual = await getNoLeidos();
  oyentes.forEach(o => o(actual));
};

export const useChatNoLeidos = (): Record<string, number> => {
  const [valor, setValor] = useState(actual);
  useEffect(() => {
    oyentes.add(setValor);
    if (oyentes.size === 1) {
      void refrescarNoLeidos();
      intervalo = setInterval(() => void refrescarNoLeidos(), 20_000);
    }
    return () => {
      oyentes.delete(setValor);
      if (oyentes.size === 0 && intervalo) { clearInterval(intervalo); intervalo = null; }
    };
  }, []);
  return valor;
};
