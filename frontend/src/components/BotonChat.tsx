import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { QuoteChat } from './QuoteChat';
import { useChatNoLeidos } from '../hooks/useChatNoLeidos';
import { ESTADOS_CON_CHAT } from '../services/chatService';

// Botón "Chatear" de una cotización aceptada, con el número de mensajes sin leer. Abre el chat a pantalla completa.
export const BotonChat: React.FC<{ quoteId: string; status: string; etiqueta: string; titulo: string; subtitulo?: string }> = ({
  quoteId, status, etiqueta, titulo, subtitulo,
}) => {
  const [abierto, setAbierto] = useState(false);
  const noLeidos = useChatNoLeidos()[quoteId] ?? 0;
  if (!ESTADOS_CON_CHAT.includes(status)) return null;
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="relative w-full mt-2 py-2.5 rounded-xl border border-ferry-200 text-ferry-700 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-ferry-50 transition-colors"
      >
        <MessageCircle className="w-4 h-4" /> {etiqueta}
        {noLeidos > 0 && (
          <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {noLeidos > 9 ? '9+' : noLeidos}
          </span>
        )}
      </button>
      {abierto && <QuoteChat quoteId={quoteId} titulo={titulo} subtitulo={subtitulo} onClose={() => setAbierto(false)} />}
    </>
  );
};
