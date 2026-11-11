import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, CheckCheck, FileText, Loader2, Paperclip, Send, ShieldAlert } from 'lucide-react';
import { enviarMensaje, getConversacion, MensajeChat, MAX_IMAGEN, MAX_PDF, TIPOS_PERMITIDOS } from '../services/chatService';
import { refrescarNoLeidos } from '../hooks/useChatNoLeidos';

const SONDEO_MS = 4000;

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const tamano = (b: number | null) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const leerComoDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(new Error('No se pudo leer el archivo'));
  r.readAsDataURL(file);
});

const Burbuja: React.FC<{ m: MensajeChat }> = ({ m }) => {
  const mia = m.from === 'me';
  return (
    <div className={`flex ${mia ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${mia ? 'bg-ferry-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'}`}>
        {m.attachment?.type === 'image' && (
          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="block mb-1">
            <img src={m.attachment.url} alt={m.attachment.name ?? 'Imagen'} className="rounded-xl max-h-60 w-auto object-cover" />
          </a>
        )}
        {m.attachment?.type === 'pdf' && (
          <a href={m.attachment.url} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-xl p-2 mb-1 ${mia ? 'bg-white/15' : 'bg-slate-50 border border-slate-100'}`}>
            <FileText className={`w-8 h-8 shrink-0 ${mia ? 'text-white' : 'text-red-500'}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{m.attachment.name || 'Documento.pdf'}</span>
              <span className={`block text-[11px] ${mia ? 'text-white/70' : 'text-slate-400'}`}>PDF · {tamano(m.attachment.size)} · Abrir</span>
            </span>
          </a>
        )}
        {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
        <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${mia ? 'text-white/70' : 'text-slate-400'}`}>
          {hora(m.createdAt)}
          {mia && (m.read ? <CheckCheck className="w-3.5 h-3.5 text-sky-200" aria-label="Leído" /> : <Check className="w-3.5 h-3.5" aria-label="Enviado" />)}
        </div>
      </div>
    </div>
  );
};

/**
 * Chat del pedido entre el cliente y la ferretería, abierto desde que se acepta la cotización.
 * Texto, imágenes y PDF; nada más. Sin tiempo real: consulta cada pocos segundos mientras está abierto.
 */
export const QuoteChat: React.FC<{ quoteId: string; titulo: string; subtitulo?: string; onClose: () => void }> = ({ quoteId, titulo, subtitulo, onClose }) => {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [aCiegas, setACiegas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState<null | 'texto' | 'archivo'>(null);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const ultimoId = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const c = await getConversacion(quoteId);
      setMensajes(c.messages);
      setACiegas(c.aCiegas);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [quoteId]);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), SONDEO_MS);
    return () => { clearInterval(t); void refrescarNoLeidos(); };
  }, [cargar]);

  // Baja al final solo cuando llega un mensaje nuevo, no en cada consulta.
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1]?.id ?? null;
    if (ultimo !== ultimoId.current) {
      ultimoId.current = ultimo;
      finRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes]);

  const enviarTexto = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando('texto');
    try {
      const m = await enviarMensaje(quoteId, { text: t });
      setMensajes(prev => [...prev, m]);
      setTexto('');
    } catch (err: any) { setError(err.message); }
    finally { setEnviando(null); }
  };

  const enviarArchivo = async (file: File | undefined) => {
    if (!file) return;
    if (!TIPOS_PERMITIDOS.includes(file.type)) { setError('Solo puedes enviar imágenes (JPG, PNG, WebP) o PDF.'); return; }
    const esPdf = file.type === 'application/pdf';
    if (file.size > (esPdf ? MAX_PDF : MAX_IMAGEN)) { setError(esPdf ? 'El PDF no puede superar 10 MB.' : 'La imagen no puede superar 15 MB.'); return; }
    setEnviando('archivo'); setError(null);
    try {
      const dataUrl = await leerComoDataUrl(file);
      const m = await enviarMensaje(quoteId, { attachment: { dataUrl, name: file.name }, text: texto.trim() || undefined });
      setMensajes(prev => [...prev, m]);
      setTexto('');
    } catch (err: any) { setError(err.message); }
    finally { setEnviando(null); }
  };

  return (
    // Mismo ancho que la app (max-w-md); en pantallas grandes el resto queda en gris.
    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex justify-center animate-in fade-in duration-200">
    <div className="w-full max-w-md h-full bg-slate-100 flex flex-col shadow-2xl">
      {/* Cabecera */}
      <div className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Cerrar chat">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 truncate">{titulo}</h3>
          {subtitulo && <p className="text-xs text-slate-500 truncate">{subtitulo}</p>}
        </div>
      </div>

      {aCiegas && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-[11px] text-amber-800 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Resuelvan aquí las dudas del pedido. Para tu seguridad, paga siempre por Ferry: así tu compra queda protegida.</span>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {cargando ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : mensajes.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10 px-6">Aún no hay mensajes. Escribe tu duda sobre el pedido; también puedes enviar fotos o un PDF.</p>
        ) : mensajes.map((m, i) => {
          const nuevoDia = i === 0 || dia(m.createdAt) !== dia(mensajes[i - 1].createdAt);
          return (
            <React.Fragment key={m.id}>
              {nuevoDia && <p className="text-center text-[11px] text-slate-400 capitalize py-1">{dia(m.createdAt)}</p>}
              <Burbuja m={m} />
            </React.Fragment>
          );
        })}
        <div ref={finRef} />
      </div>

      {error && <p className="bg-red-50 text-red-600 text-xs px-4 py-2 border-t border-red-100">{error}</p>}

      {/* Pie: solo imágenes y PDF */}
      <div className="bg-white border-t border-slate-200 px-3 py-2.5 flex items-center gap-2" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
          onChange={e => { void enviarArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { void enviarArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={() => archivoRef.current?.click()} disabled={!!enviando}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40" title="Adjuntar imagen o PDF">
          {enviando === 'archivo' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </button>
        <button onClick={() => camaraRef.current?.click()} disabled={!!enviando}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40" title="Tomar foto">
          <Camera className="w-5 h-5" />
        </button>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviarTexto(); } }}
          maxLength={2000}
          placeholder="Escribe un mensaje"
          className="flex-1 min-w-0 bg-slate-100 text-sm rounded-full px-4 py-2.5 outline-none border border-transparent focus:bg-white focus:border-ferry-400"
        />
        <button onClick={() => void enviarTexto()} disabled={!texto.trim() || !!enviando}
          className="w-10 h-10 rounded-full bg-ferry-600 text-white flex items-center justify-center hover:bg-ferry-700 disabled:opacity-40 shrink-0" aria-label="Enviar">
          {enviando === 'texto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
    </div>
  );
};
