import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, Store, ArrowRight } from 'lucide-react';
import { OpinionesPublicas } from '../components/OpinionesDeTienda';
import { getCatalogoPublico, registrarVisita, CatalogoPublicoData } from '../services/catalogShareService';

const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;

// Lo que se ve al escanear el QR de una ferretería. No pide sesión: solo para pedir cotización hay que entrar.
export const CatalogoPublico: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [data, setData] = useState<CatalogoPublicoData | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-existe'>('cargando');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);

  useEffect(() => { registrarVisita(storeId); }, [storeId]);

  useEffect(() => {
    let cancelled = false;
    getCatalogoPublico(storeId).then(r => {
      if (cancelled) return;
      if (r) { setData(r); setEstado('listo'); } else setEstado('no-existe');
    });
    return () => { cancelled = true; };
  }, [storeId]);

  const categorias = useMemo(() => Array.from(new Set((data?.products ?? []).map(p => p.category))), [data]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data?.products ?? []).filter(
      p => (!categoria || p.category === categoria) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [data, busqueda, categoria]);

  if (estado === 'cargando') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Cargando catálogo…</div>;
  }

  if (estado === 'no-existe' || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50">
        <Store className="w-10 h-10 text-slate-300" />
        <p className="font-bold text-slate-700">No encontramos este catálogo</p>
        <a href="/" className="text-ferry-600 text-sm font-semibold">Ir a Ferry</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto pb-24">
        <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
          {data.store.photoUrl ? (
            <img src={data.store.photoUrl} alt={data.store.name} className="w-12 h-12 rounded-full object-cover bg-slate-700" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ferry-600 flex items-center justify-center font-bold text-lg">
              {data.store.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Catálogo de</p>
            <h1 className="font-bold text-lg leading-tight truncate">{data.store.name}</h1>
            {data.store.specialties.length > 0 && (
              <p className="text-xs text-slate-400 truncate">{data.store.specialties.join(' · ')}</p>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-ferry-500"
            />
          </div>

          {categorias.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {['Todos', ...categorias].map(c => (
                <button
                  key={c}
                  onClick={() => setCategoria(c === 'Todos' ? null : c)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    (c === 'Todos' && !categoria) || c === categoria
                      ? 'bg-ferry-600 border-ferry-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {visibles.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">
              {data.products.length === 0 ? 'Esta ferretería aún no ha publicado productos.' : 'Sin resultados.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibles.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="h-28 bg-slate-100 relative flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-300" />
                    )}
                    {p.discountPercent > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        -{p.discountPercent}%
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="font-bold text-xs text-slate-700 line-clamp-2 mb-1">{p.name}</h2>
                    <div className="flex items-end gap-2">
                      <span className="font-bold text-ferry-600">{pesos(p.finalPrice)}</span>
                      {p.discountPercent > 0 && (
                        <span className="text-[10px] text-slate-400 line-through decoration-red-400">{pesos(p.price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <OpinionesPublicas storeId={storeId} />
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-100 p-3">
          <a
            href="/"
            className="max-w-md mx-auto flex items-center justify-center gap-2 bg-ferry-600 hover:bg-ferry-700 text-white font-bold text-sm py-3 rounded-xl"
          >
            Pedir cotización en Ferry <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default CatalogoPublico;
