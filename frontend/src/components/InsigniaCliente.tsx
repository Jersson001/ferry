import React from 'react';
import { HistorialCliente } from '../services/quoteService';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const nombreDeNivel = (h: HistorialCliente) =>
  h.nivel === 'frecuente' ? 'Cliente frecuente' : h.nivel === 'activo' ? 'Cliente activo' : 'Cliente nuevo';

// Detalle en cifras: lo que de verdad ha hecho en Ferry.
export const detalleDeUso = (h: HistorialCliente) =>
  h.entregados > 0
    ? `${plural(h.entregados, 'pedido entregado', 'pedidos entregados')} · ${plural(h.solicitudes, 'solicitud', 'solicitudes')}`
    : plural(h.solicitudes, 'solicitud', 'solicitudes');

const ESTILO: Record<HistorialCliente['nivel'], string> = {
  nuevo: 'bg-slate-50 text-slate-500 border-slate-200',
  activo: 'bg-blue-50 text-blue-700 border-blue-100',
  frecuente: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

// Lo que ve una ferretería sobre quien pide: cuánto ha usado Ferry, sin decir quién es.
export const InsigniaCliente: React.FC<{ historial?: HistorialCliente }> = ({ historial }) => {
  if (!historial) return null;
  return (
    <span
      title={detalleDeUso(historial)}
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border tracking-wide ${ESTILO[historial.nivel]}`}
    >
      {nombreDeNivel(historial)}
      {historial.nivel !== 'nuevo' && <> · {detalleDeUso(historial)}</>}
    </span>
  );
};

export default InsigniaCliente;
