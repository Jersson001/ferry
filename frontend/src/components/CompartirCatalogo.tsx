import React, { useEffect, useState } from 'react';
import { X, QrCode, Copy, Download, Check } from 'lucide-react';
import { enlaceDelCatalogo, qrComoImagen } from '../services/catalogShareService';

interface Props {
  storeId: string;
  storeName: string;
  onClose: () => void;
}

export const CompartirCatalogo: React.FC<Props> = ({ storeId, storeName, onClose }) => {
  const enlace = enlaceDelCatalogo(storeId);
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    qrComoImagen(`${enlace}?via=qr`, 768).then(url => { if (!cancelled) setQr(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [enlace]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles: el enlace queda visible para copiarlo a mano */ }
  };

  const porWhatsApp = () => {
    const texto = `¡Mira el catálogo de ${storeName}!\n${enlace}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-4 flex items-center gap-3">
          <QrCode className="w-5 h-5 text-white" />
          <h2 className="flex-1 text-white font-bold">Compartir catálogo</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-white/70 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-center font-bold text-slate-900 mb-3">{storeName}</p>
          <div className="border-2 border-slate-200 rounded-2xl p-3 flex justify-center mb-3 min-h-[13rem] items-center">
            {qr ? <img src={qr} alt="QR del catálogo" className="w-52 h-52" /> : <span className="text-xs text-slate-400">Generando…</span>}
          </div>
          <p className="text-xs text-center text-slate-500 mb-4">
            Quien lo escanee ve tu catálogo con precios <strong>sin registrarse</strong>. Si cambias productos,
            el mismo QR muestra lo nuevo.
          </p>

          <button onClick={copiar} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-left hover:bg-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1 mb-0.5">
              {copiado ? <><Check className="w-3 h-3" /> Enlace copiado</> : <><Copy className="w-3 h-3" /> Toca para copiar</>}
            </span>
            <span className="text-xs text-slate-700 break-all">{enlace}</span>
          </button>

          <div className="flex gap-2">
            <button onClick={porWhatsApp} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm">
              WhatsApp
            </button>
            {qr && (
              <a
                href={qr}
                download={`catalogo-${storeName.replace(/[^\w]+/g, '-').toLowerCase()}.png`}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompartirCatalogo;
