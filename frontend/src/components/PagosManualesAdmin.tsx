import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Card } from './UIComponents';
import { PagoManualPendiente, getPagosManualesPendientes, revisarPagoManual } from '../services/adminService';

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Comprobantes de pago por Nequi/Bre-B a la llave de Ferry. Un pantallazo se falsifica fácil: aprueba
// solo si el movimiento aparece en el Nequi de Ferry por ese valor. Aprobar deja el pedido pagado y la
// ferretería empieza a alistar; rechazar lo devuelve a "esperando pago".
export const PagosManualesAdmin: React.FC = () => {
  const [lista, setLista] = useState<PagoManualPendiente[] | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = () => {
    setError('');
    getPagosManualesPendientes().then(setLista).catch(e => setError(e.message));
  };
  useEffect(cargar, []);

  const revisar = async (p: PagoManualPendiente, aprobar: boolean) => {
    const pregunta = aprobar
      ? `¿Confirmas que en el Nequi de Ferry entraron $${p.amount.toLocaleString('es-CO')} (ref. ${p.reference})? El pedido quedará pagado.`
      : '¿Rechazar este comprobante? El pedido vuelve a esperar el pago del cliente.';
    if (!window.confirm(pregunta)) return;
    setTrabajando(p.id);
    setError('');
    try {
      await revisarPagoManual(p.id, aprobar);
      setLista(l => l && l.filter(x => x.id !== p.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTrabajando(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="p-4 shadow-sm border-slate-200 flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500">
          Revisa cada comprobante contra los movimientos del Nequi de Ferry. Aprueba solo si el pago aparece por el valor exacto: el pantallazo por sí solo no prueba nada.
        </p>
        <button onClick={cargar} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Actualizar">
          <RefreshCw className="w-4 h-4" />
        </button>
      </Card>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {lista === null ? (
        <p className="text-sm text-slate-400 py-8 text-center">{error ? '' : 'Cargando…'}</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No hay comprobantes por revisar.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map(p => (
            <li key={p.id} className="bg-white border-2 border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-900 text-xl">$ {p.amount.toLocaleString('es-CO')}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {p.requestDisplayId ? `#${p.requestDisplayId} · ` : ''}{p.requestTitle || 'Pedido'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    <strong>{p.clientName || 'Cliente'}</strong>{p.clientPhone ? ` · ${p.clientPhone}` : ''} → {p.storeName || 'Ferretería'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ref. {p.reference} · {fecha(p.createdAt)}</p>
                </div>
                {p.proofUrl && (
                  <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={p.proofUrl} alt="Comprobante" className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                  </a>
                )}
              </div>
              {p.quoteStatus && p.quoteStatus !== 'PENDING_VALIDATION' && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg p-2">
                  El pedido ya está en estado {p.quoteStatus} (quizá pagó también por Wompi). Revisa antes de aprobar: podría ser un pago doble.
                </p>
              )}
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-ferry-600 flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver comprobante completo
                </a>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => revisar(p, false)}
                  disabled={trabajando === p.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Rechazar
                </button>
                <button
                  onClick={() => revisar(p, true)}
                  disabled={trabajando === p.id}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> {trabajando === p.id ? 'Guardando…' : 'Llegó: aprobar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
