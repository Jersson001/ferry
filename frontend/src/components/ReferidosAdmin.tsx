import React, { useEffect, useState } from 'react';
import { Copy, Check, Loader2, Plus } from 'lucide-react';
import { Card, Button } from './UIComponents';
import { CodigoReferido, activarCodigo, crearCodigo, enlaceDeReferido, listarCodigos } from '../services/referralService';

export const ReferidosAdmin: React.FC = () => {
  const [codigos, setCodigos] = useState<CodigoReferido[] | null>(null);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [creando, setCreando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const cargar = () => {
    listarCodigos().then(setCodigos).catch(e => setError(e.message));
  };
  useEffect(cargar, []);

  const crear = async () => {
    setCreando(true);
    setError('');
    try {
      await crearCodigo(nombre, codigo);
      setNombre('');
      setCodigo('');
      cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  };

  const copiar = async (code: string) => {
    try {
      await navigator.clipboard.writeText(enlaceDeReferido(code));
      setCopiado(code);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* sin portapapeles */ }
  };

  const alternar = async (c: CodigoReferido) => {
    try {
      await activarCodigo(c.code, !c.active);
      cargar();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="shadow-xl border-slate-200 p-6">
        <h3 className="text-xl font-bold text-slate-900">Códigos de referido</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Cada código identifica a quien trae gente: una comunidad, un aliado, una ferretería. Se reparte como enlace
          y la cuenta nueva queda atribuida si se registra en sus primeros 7 días.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="¿De quién es? (ej. Ferretería El Tornillo)"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-ferry-500"
          />
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={20}
            placeholder="Código (opcional)"
            className="sm:w-44 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-ferry-500"
          />
          <Button onClick={crear} disabled={creando || !nombre.trim()} className="text-sm font-bold">
            {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 inline mr-1" />Crear</>}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Si dejas el código vacío, Ferry genera uno de 6 caracteres.</p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </Card>

      <Card className="shadow-xl border-slate-200 p-0 overflow-hidden">
        {codigos === null ? (
          <div className="p-8 text-center text-slate-400 text-sm">{error ? '' : 'Cargando…'}</div>
        ) : codigos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Aún no hay códigos.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {codigos.map(c => (
              <li key={c.code} className={`p-4 flex items-center gap-3 ${c.active ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-slate-900">{c.code}</p>
                  <p className="text-xs text-slate-500 truncate">{c.name}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="font-bold text-slate-800 text-sm">{c.total}</p>
                  <p>{c.tiendas} tiendas · {c.clientes} clientes</p>
                </div>
                <button
                  onClick={() => copiar(c.code)}
                  aria-label={`Copiar enlace de ${c.code}`}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  {copiado === c.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button onClick={() => alternar(c)} className="text-xs font-bold text-slate-500 hover:text-slate-800 w-16 text-right">
                  {c.active ? 'Desactivar' : 'Activar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ReferidosAdmin;
