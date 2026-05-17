import React, { useState, useRef } from 'react';
import { X, Image, Video, Link, Upload, Loader2 } from 'lucide-react';
import { PortfolioItem } from '../types';
import { validatePortfolioFile, uploadPortfolioFile, addPortfolioLink } from '../services/portfolioService';

interface Props {
  onClose: () => void;
  onAdded: (item: PortfolioItem) => void;
}

type ItemType = 'image' | 'video' | 'link';

const TYPE_OPTIONS: { type: ItemType; label: string; icon: React.ReactNode }[] = [
  { type: 'image', label: 'Imagen', icon: <Image className="w-5 h-5" /> },
  { type: 'video', label: 'Video', icon: <Video className="w-5 h-5" /> },
  { type: 'link', label: 'Enlace', icon: <Link className="w-5 h-5" /> },
];

export const AddPortfolioItemModal: React.FC<Props> = ({ onClose, onAdded }) => {
  const [selectedType, setSelectedType] = useState<ItemType>('image');
  const [linkUrl, setLinkUrl] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const validationError = validatePortfolioFile(picked, selectedType as 'image' | 'video');
    if (validationError) { setError(validationError); return; }
    setError(null);
    setFile(picked);
    if (selectedType === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(picked);
    } else {
      setPreview(URL.createObjectURL(picked));
    }
  };

  const handleTypeChange = (t: ItemType) => {
    setSelectedType(t);
    setFile(null);
    setPreview(null);
    setError(null);
    setLinkUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setError(null);

    if (selectedType === 'link') {
      if (!linkUrl.trim()) { setError('Ingresa un enlace válido.'); return; }
      try { new URL(linkUrl); } catch { setError('La URL no es válida.'); return; }
    } else {
      if (!file) { setError('Selecciona un archivo.'); return; }
    }

    setUploading(true);
    try {
      let newItem: PortfolioItem;

      if (selectedType === 'link') {
        newItem = await addPortfolioLink(linkUrl.trim(), description.trim());
      } else {
        newItem = await uploadPortfolioFile(file!, description.trim());
      }

      onAdded(newItem);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Error al subir. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const accept = selectedType === 'image' ? 'image/*' : selectedType === 'video' ? 'video/*' : undefined;
  const sizeHint = selectedType === 'image' ? 'Máx. 5 MB' : selectedType === 'video' ? 'Máx. 30 MB' : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Agregar al portafolio</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 text-xs font-bold transition-all ${
                  selectedType === type
                    ? 'border-ferry-500 bg-ferry-50 text-ferry-600'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* File / Link input */}
          {selectedType !== 'link' ? (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 hover:border-ferry-400 rounded-2xl p-5 flex flex-col items-center gap-2 text-slate-400 hover:text-ferry-500 transition-all"
              >
                {preview ? (
                  selectedType === 'image' ? (
                    <img src={preview} className="w-full h-40 object-cover rounded-xl" alt="preview" />
                  ) : (
                    <video src={preview} className="w-full h-40 rounded-xl object-cover" muted playsInline />
                  )
                ) : (
                  <>
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-semibold">
                      {selectedType === 'image' ? 'Seleccionar imagen' : 'Seleccionar video'}
                    </span>
                    {sizeHint && <span className="text-xs">{sizeHint}</span>}
                  </>
                )}
              </button>
              {preview && (
                <button
                  onClick={() => { setFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="mt-1 text-xs text-slate-400 hover:text-red-400 mx-auto block"
                >
                  Cambiar archivo
                </button>
              )}
              <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL</label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://instagram.com/tu.perfil"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-ferry-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Descripción <span className="font-normal normal-case">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Remodelación de cocina en Cedritos, Bogotá..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-ferry-500 outline-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full h-12 bg-ferry-600 hover:bg-ferry-700 disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-ferry-200"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? 'Subiendo...' : 'Agregar al portafolio'}
          </button>
        </div>
      </div>
    </div>
  );
};
