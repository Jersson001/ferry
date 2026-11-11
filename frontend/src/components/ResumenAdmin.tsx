import React, { useEffect, useState } from 'react';
import { Users, Store, ClipboardList, PackageCheck, Star, QrCode, Gift } from 'lucide-react';
import { Card } from './UIComponents';
import { ResumenAdmin as Resumen, getResumenAdmin } from '../services/adminService';

const Dato: React.FC<{ icono: React.ReactNode; valor: React.ReactNode; titulo: string; detalle?: string }> = ({ icono, valor, titulo, detalle }) => (
  <Card className="p-4 shadow-sm border-slate-200">
    <div className="flex items-center gap-2 text-slate-400 mb-2">{icono}<span className="text-[11px] font-bold uppercase tracking-wide">{titulo}</span></div>
    <p className="text-3xl font-black text-slate-900 leading-none">{valor}</p>
    {detalle && <p className="text-xs text-slate-500 mt-2">{detalle}</p>}
  </Card>
);

export const ResumenAdminPanel: React.FC = () => {
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getResumenAdmin().then(setR).catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;
  if (!r) return <p className="text-sm text-slate-400 py-10 text-center">Cargando…</p>;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-3">
        <Dato icono={<Users className="w-4 h-4" />} titulo="Usuarios" valor={r.usuarios.total}
          detalle={`${r.usuarios.clientes} clientes · ${r.usuarios.tiendas} ferreterías · +${r.usuarios.nuevos7d} esta semana`} />
        <Dato icono={<ClipboardList className="w-4 h-4" />} titulo="Solicitudes" valor={r.solicitudes.total}
          detalle={`+${r.solicitudes.nuevas7d} esta semana`} />
        <Dato icono={<PackageCheck className="w-4 h-4" />} titulo="Pedidos entregados" valor={r.pedidosEntregados} />
        <Dato icono={<Star className="w-4 h-4" />} titulo="Opiniones" valor={r.opiniones.promedio !== null ? r.opiniones.promedio.toFixed(1) : '—'}
          detalle={`${r.opiniones.total} en total${r.opiniones.ocultas ? ` · ${r.opiniones.ocultas} ocultas` : ''}`} />
        <Dato icono={<QrCode className="w-4 h-4" />} titulo="Visitas al catálogo (7 días)" valor={r.catalogo.visitas7d}
          detalle={`${r.catalogo.porQr7d} por QR`} />
        <Dato icono={<Gift className="w-4 h-4" />} titulo="Cuentas por referido" valor={r.referidos} />
      </div>

      <Card className="p-4 shadow-sm border-slate-200">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          <Store className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wide">Catálogos más vistos (7 días)</span>
        </div>
        {r.catalogo.masVistas.length === 0 ? (
          <p className="text-sm text-slate-400">Aún nadie ha abierto un catálogo.</p>
        ) : (
          <ol className="space-y-2">
            {r.catalogo.masVistas.map((t, i) => (
              <li key={t.storeId} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-bold text-slate-400">{i + 1}</span>
                <span className="flex-1 truncate font-semibold text-slate-700">{t.name}</span>
                <span className="font-bold text-slate-900">{t.visitas}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
};

export default ResumenAdminPanel;
