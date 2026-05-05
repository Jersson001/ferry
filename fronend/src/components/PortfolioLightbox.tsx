import React, { useState } from 'react';
import { X, Trash2, ExternalLink, Loader2, PlayCircle } from 'lucide-react';
import { PortfolioItem } from '../types';
import { removePortfolioItem } from '../services/portfolioService';

interface Props {
  item: PortfolioItem;
  onClose: () => void;
  onDeleted: (item: PortfolioItem) => void;
}

export const PortfolioLightbox: React.FC<Props> = ({ item, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await removePortfolioItem(item);
      onDeleted(item);
      onClose();
    } catch (e) {
      console.error('Error deleting portfolio item:', e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg flex flex-col rounded-2xl overflow-hidden bg-black"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media */}
        <div className="w-full bg-black flex items-center justify-center min-h-48 max-h-[60vh]">
          {item.type === 'image' && (
            <img
              src={item.url}
              alt={item.description || 'Imagen del portafolio'}
              className="w-full max-h-[60vh] object-contain"
              onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Sin+imagen'; }}
            />
          )}

          {item.type === 'video' && (
            <video
              src={item.url}
              controls
              className="w-full max-h-[60vh]"
              playsInline
            />
          )}

          {item.type === 'link' && (
            <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="w-16 h-16 bg-ferry-100 rounded-full flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-ferry-600" />
              </div>
              <p className="text-white text-sm break-all">{item.url}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 bg-ferry-600 text-white font-bold rounded-xl hover:bg-ferry-700 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Abrir enlace
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-4 py-4">
          {item.description ? (
            <p className="text-slate-700 text-sm leading-relaxed mb-3">{item.description}</p>
          ) : (
            <p className="text-slate-400 text-sm italic mb-3">Sin descripción.</p>
          )}

          <div className="flex items-center gap-2">
            {item.type === 'link' && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 flex items-center justify-center gap-1.5 border border-ferry-200 text-ferry-600 font-bold text-sm rounded-xl hover:bg-ferry-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Visitar
              </a>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`flex items-center gap-1.5 h-10 px-4 rounded-xl font-bold text-sm transition-all ${
                confirmDelete
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border border-red-200 text-red-500 hover:bg-red-50'
              } disabled:opacity-60`}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {confirmDelete ? 'Confirmar eliminación' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
