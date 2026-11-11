import React from 'react';
import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { UserProfile } from '../types';
import { ETIQUETA_RUT, VerificacionRut } from '../utils/rut';

const COLOR: Record<string, string> = {
  VERIFICADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SIN_CONSULTA: 'bg-slate-50 text-slate-600 border-slate-200',
};
const ALERTA = 'bg-amber-50 text-amber-800 border-amber-200';

// Estado del RUT en el perfil de la ferretería, con lo que tiene que hacer si no quedó verificado.
export const EstadoRutPerfil: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const v = profile.rutVerificacion;
  if (!profile.rut) {
    return (
      <p className="text-[11px] text-slate-500 mt-2 max-w-xs mx-auto">
        Agrega el NIT de tu negocio: lo verificamos en el registro mercantil y es necesario para el sello de ferretería verificada.
      </p>
    );
  }
  if (!v) return null;
  const Icono = v.estado === 'VERIFICADO' ? ShieldCheck : v.estado === 'SIN_CONSULTA' ? Clock : ShieldAlert;
  return (
    <div className={`mt-2 mx-auto max-w-xs border rounded-xl px-3 py-2 text-left ${COLOR[v.estado] ?? ALERTA}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold">
        <Icono className="w-3.5 h-3.5 shrink-0" /> {ETIQUETA_RUT[v.estado]}
      </div>
      <p className="text-[11px] mt-0.5 leading-snug">
        {v.estado === 'VERIFICADO'
          ? `${v.razonSocial ?? ''}${v.camara ? ` · Cámara de Comercio de ${v.camara.toLowerCase()}` : ''}`
          : v.mensaje}
      </p>
    </div>
  );
};

// Etiqueta compacta para la tabla de usuarios del panel de administración.
export const InsigniaRut: React.FC<{ rut?: string | null; verificacion?: VerificacionRut | null }> = ({ rut, verificacion }) => {
  if (!rut) return <span className="text-xs text-slate-400">Sin RUT</span>;
  const v = verificacion;
  return (
    <div className="text-xs" title={v?.mensaje}>
      <div className="font-mono text-slate-700">{rut}</div>
      <span className={`inline-block mt-0.5 border rounded-full px-2 py-0.5 font-bold ${v ? COLOR[v.estado] ?? ALERTA : COLOR.SIN_CONSULTA}`}>
        {v ? ETIQUETA_RUT[v.estado] : 'Sin verificar'}
      </span>
      {v?.razonSocial && <div className="text-slate-500 mt-0.5 max-w-[14rem] truncate">{v.razonSocial}</div>}
    </div>
  );
};
