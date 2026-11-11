import React, { useEffect, useState } from 'react';
import { Star, Eye, EyeOff } from 'lucide-react';
import { Card } from './UIComponents';
import { OpinionAdmin, getOpinionesAdmin, ocultarOpinion } from '../services/adminService';

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Todas las opiniones, también las ocultas. Ocultar una la saca del catálogo público y del promedio.
export const OpinionesAdmin: React.FC = () => {
  const [lista, setLista] = useState<OpinionAdmin[] | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [soloConComentario, setSoloConComentario] = useState(false);

  useEffect(() => {
    getOpinionesAdmin().then(setLista).catch(e => setError(e.message));
  }, []);

  const alternar = async (o: OpinionAdmin) => {
    setTrabajando(o.id);
    setError('');
    try {
      await ocultarOpinion(o, !o.hidden);
      setLista(l => l && l.map(x => (x.id === o.id && x.kind === o.kind ? { ...x, hidden: !o.hidden } : x)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTrabajando(null);
    }
  };

  const visibles = (lista ?? []).filter(o => !soloConComentario || o.comment);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="p-4 shadow-sm border-slate-200 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Oculta solo abusos evidentes. Una opinión oculta deja de verse en el catálogo y de contar en el promedio; puedes volver a mostrarla.
        </p>
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 whitespace-nowrap">
          <input type="checkbox" checked={soloConComentario} onChange={e => setSoloConComentario(e.target.checked)} />
          Con comentario
        </label>
      </Card>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {lista === null ? (
        <p className="text-sm text-slate-400 py-8 text-center">{error ? '' : 'Cargando…'}</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Aún no hay opiniones.</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map(o => (
            <li key={`${o.kind}-${o.id}`} className={`bg-white border border-slate-200 rounded-xl p-3 ${o.hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i <= o.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                  ))}
                </span>
                <span className="text-xs text-slate-600 truncate">
                  <strong>{o.client}</strong> → {o.store}{o.kind === 'contratista' && <em className="not-italic text-slate-400"> (profesional)</em>}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{fecha(o.date)}</span>
              </div>
              {o.comment && <p className="text-sm text-slate-700">{o.comment}</p>}
              {o.reply && <p className="text-xs text-slate-500 mt-1 pl-2 border-l-2 border-ferry-200">Respuesta: {o.reply}</p>}
              <button
                onClick={() => alternar(o)}
                disabled={trabajando === o.id}
                className="mt-2 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 disabled:opacity-50"
              >
                {o.hidden ? <><Eye className="w-3.5 h-3.5" /> Volver a mostrar</> : <><EyeOff className="w-3.5 h-3.5" /> Ocultar</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OpinionesAdmin;
