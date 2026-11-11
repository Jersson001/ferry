import React from 'react';
import { UsoPlan } from '../services/subscriptionService';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
const pesos = (cents: number) => `$${(cents / 100).toLocaleString('es-CO')}`;

const Barra: React.FC<{ etiqueta: string; usados: number; limite: number; color: string }> = ({ etiqueta, usados, limite, color }) => {
  const ilimitado = limite === -1;
  const agotado = !ilimitado && usados >= limite;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
        <span>{etiqueta}</span>
        <span className={agotado ? 'text-orange-600' : ''}>{ilimitado ? `${usados} · sin límite` : `${usados} / ${limite}`}</span>
      </div>
      {!ilimitado && (
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${agotado ? 'bg-orange-500' : color}`}
            style={{ width: `${Math.min(100, (usados / Math.max(1, limite)) * 100)}%` }} />
        </div>
      )}
    </div>
  );
};

// Cupos del mes del plan vigente de un usuario: lo usado contra lo que incluye.
export const UsoDelPlan: React.FC<{ uso: UsoPlan }> = ({ uso }) => (
  <div className="space-y-3">
    <Barra etiqueta="🤖 Transcripciones de IA" usados={uso.usados.transcripcionesIa} limite={uso.limites.transcripcionesIa} color="bg-violet-500" />
    <Barra etiqueta="📢 Proyectos publicados" usados={uso.usados.proyectos} limite={uso.limites.proyectos} color="bg-ferry-500" />
    {uso.limites.postulaciones !== -1 && (
      <Barra etiqueta="📝 Postulaciones" usados={uso.usados.postulaciones} limite={uso.limites.postulaciones} color="bg-blue-500" />
    )}
    {uso.limites.contactosIncluidos > 0 && (
      <Barra etiqueta="📞 Contactos de clientes incluidos" usados={uso.usados.contactosIncluidos} limite={uso.limites.contactosIncluidos} color="bg-green-500" />
    )}
    <p className="text-[11px] text-slate-500">
      Cada solicitud de materiales recibe hasta {uso.limites.tiendasPorSolicitud} cotizaciones.
      {' '}Contacto adicional de un cliente: {pesos(uso.precioContactoInCents)}.
      {' '}{uso.pago ? `Tu plan vence el ${fecha(uso.fin)}.` : `Los cupos se renuevan el ${fecha(uso.fin)}.`}
    </p>
  </div>
);
