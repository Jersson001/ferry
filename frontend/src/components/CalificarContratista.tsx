import React, { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';

interface Props {
  nombre: string;
  // true: el proyecto aún está en progreso y esta ventana también lo da por terminado
  terminando: boolean;
  onConfirm: (rating: number | null, comment: string) => Promise<void>;
  onClose: () => void;
}

// El cliente da por terminado el proyecto y califica (o no) al profesional que contrató.
export const CalificarContratista: React.FC<Props> = ({ nombre, terminando, onConfirm, onClose }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (conCalificacion: boolean) => {
    setEnviando(true);
    setError('');
    try {
      await onConfirm(conCalificacion ? rating : null, comment);
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la acción');
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">{terminando ? 'Terminar proyecto' : 'Calificar profesional'}</h2>
            <p className="text-sm text-slate-500">¿Cómo te fue con <strong>{nombre}</strong>?</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrellas`} className="hover:scale-110 transition-transform">
              <Star className={`w-9 h-9 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Cuéntales a otros cómo fue trabajar con esta persona (opcional)"
          className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-ferry-500 resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={() => enviar(true)}
          disabled={enviando || rating === 0}
          className="w-full py-3 rounded-xl bg-ferry-600 hover:bg-ferry-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : terminando ? 'Terminar y calificar' : 'Enviar calificación'}
        </button>
        {terminando && (
          <button onClick={() => enviar(false)} disabled={enviando} className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700">
            Terminar sin calificar
          </button>
        )}
      </div>
    </div>
  );
};

export default CalificarContratista;
