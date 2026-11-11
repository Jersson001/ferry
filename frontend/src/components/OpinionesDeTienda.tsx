import React, { useEffect, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Opinion, getOpiniones, getMisOpiniones, responderOpinion, ResumenOpiniones } from '../services/quoteService';

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const Estrellas: React.FC<{ n: number }> = ({ n }) => (
  <span className="inline-flex" aria-label={`${n} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
    ))}
  </span>
);

const Resumen: React.FC<{ r: ResumenOpiniones }> = ({ r }) => (
  <div className="flex items-center gap-2">
    <MessageSquare className="w-4 h-4 text-ferry-600" />
    <h3 className="font-bold text-slate-800 text-sm">Opiniones</h3>
    {r.rating !== null && (
      <span className="flex items-center gap-1 text-sm font-bold text-yellow-500">
        <Star className="w-4 h-4 fill-yellow-500" /> {r.rating.toFixed(1)}
        <span className="text-xs font-normal text-slate-400">({r.reviews})</span>
      </span>
    )}
  </div>
);

const Tarjeta: React.FC<{ o: Opinion; children?: React.ReactNode }> = ({ o, children }) => (
  <li className="bg-white border border-slate-100 rounded-xl p-3">
    <div className="flex items-center gap-2 mb-1">
      <Estrellas n={o.rating} />
      <span className="text-xs font-semibold text-slate-600">{o.author}</span>
      <span className="text-[10px] text-slate-400 ml-auto">{fecha(o.date)}</span>
    </div>
    {o.comment && <p className="text-xs text-slate-600">{o.comment}</p>}
    {o.reply && (
      <div className="mt-2 ml-3 pl-3 border-l-2 border-ferry-200">
        <p className="text-[10px] font-bold text-ferry-700 uppercase">Respuesta de la ferretería</p>
        <p className="text-xs text-slate-600">{o.reply}</p>
      </div>
    )}
    {children}
  </li>
);

// Lo que ve quien abre el catálogo público de una ferretería. Sin opiniones, no se muestra.
export const OpinionesPublicas: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [data, setData] = useState<ResumenOpiniones | null>(null);
  useEffect(() => {
    let cancelled = false;
    getOpiniones(storeId).then(r => { if (!cancelled) setData(r); });
    return () => { cancelled = true; };
  }, [storeId]);

  if (!data || data.reviews === 0) return null;
  return (
    <section className="space-y-2">
      <Resumen r={data} />
      <ul className="space-y-2">{data.items.map((o, i) => <Tarjeta key={i} o={o} />)}</ul>
    </section>
  );
};

// Las opiniones de la propia ferretería, con la opción de responder una vez a cada una.
export const MisOpiniones: React.FC = () => {
  const [data, setData] = useState<ResumenOpiniones | null>(null);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMisOpiniones().then(r => { if (!cancelled) setData(r); });
    return () => { cancelled = true; };
  }, []);

  if (!data || data.reviews === 0) return null;

  const enviar = async (id: string) => {
    setEnviando(true);
    setError('');
    try {
      await responderOpinion(id, texto);
      setData(d => d && ({ ...d, items: d.items.map(o => (o.id === id ? { ...o, reply: texto.trim(), repliedAt: new Date().toISOString() } : o)) }));
      setRespondiendo(null);
      setTexto('');
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar la respuesta');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-2 mx-2">
      <Resumen r={data} />
      <ul className="space-y-2">
        {data.items.map((o, i) => (
          <Tarjeta key={o.id ?? i} o={o}>
            {!o.reply && o.id && (
              respondiendo === o.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="Escribe tu respuesta (solo puedes responder una vez)"
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-ferry-500 resize-none"
                  />
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => enviar(o.id!)}
                      disabled={enviando || !texto.trim()}
                      className="px-3 py-1.5 rounded-lg bg-ferry-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {enviando ? 'Enviando…' : 'Responder'}
                    </button>
                    <button onClick={() => { setRespondiendo(null); setTexto(''); setError(''); }} className="px-3 py-1.5 text-xs text-slate-500">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setRespondiendo(o.id!); setTexto(''); setError(''); }} className="mt-2 text-xs font-bold text-ferry-600">
                  Responder
                </button>
              )
            )}
          </Tarjeta>
        ))}
      </ul>
    </section>
  );
};
