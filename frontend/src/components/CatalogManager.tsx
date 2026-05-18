import React, { useState, useRef, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Plus, Upload, Link2, Download, X, Check, AlertCircle, Loader2,
  ChevronLeft, Package, FileSpreadsheet, Trash2, Eye, RefreshCw,
  Image as ImageIcon, Percent, Tag, Copy, ClipboardPaste, Pencil,
  Layers, FolderPlus, Search, SlidersHorizontal, Info,
} from 'lucide-react';
import {
  CatalogProduct, CatalogProductStored,
  upsertProducts, getStoreCatalogProducts, deleteCatalogProduct,
  normalizeRow, fetchGoogleSheetCsv, downloadCsvTemplate, formatImageUrl,
} from '../services/catalogService';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'list' | 'manual' | 'bulk' | 'sheets';

interface Props {
  storeId: string;
  storeName: string;
  onClose: () => void;
}

// ─── Empty form state ─────────────────────────────────────────────────────────
const EMPTY_FORM: CatalogProduct = {
  sku: '', name: '', price: 0, stock: 0,
  category: 'General', description: '', image: '',
  isOnOffer: false, discountPercent: 0, family: '',
};

const CATEGORIES = [
  'General', 'Obra Civil', 'Plomería', 'Eléctricos', 'Iluminación',
  'Carpintería', 'Estructural', 'Cerrajería', 'Pintura', 'Herramientas',
  'Ferretería', 'Otro',
];

// ─── Product Preview Card ─────────────────────────────────────────────────────
const ProductPreviewCard: React.FC<{ product: CatalogProduct }> = ({ product }) => {
  const discountedPrice = product.isOnOffer && product.discountPercent
    ? product.price * (1 - product.discountPercent / 100)
    : null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col w-44">
      <div className="h-28 bg-slate-100 relative flex items-center justify-center">
        {product.image ? (
          <CatalogImage src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-10 h-10 text-slate-300" />
        )}
        <span className="absolute top-1.5 left-1.5 bg-slate-800/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
          {product.sku || 'SKU'}
        </span>
        {product.isOnOffer && product.discountPercent ? (
          <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            -{product.discountPercent}%
          </span>
        ) : null}
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <span className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">{product.category}</span>
        <p className="font-bold text-xs text-slate-800 leading-tight mb-2 line-clamp-2">{product.name || 'Nombre del producto'}</p>
        <div className="mt-auto flex justify-between items-end">
          <div>
            {discountedPrice !== null ? (
              <>
                <span className="text-ferry-600 font-bold text-sm">${discountedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-[9px] text-slate-400 line-through ml-1">${(product.price || 0).toLocaleString()}</span>
              </>
            ) : (
              <span className="text-ferry-600 font-bold text-sm">${(product.price || 0).toLocaleString()}</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">Stock: {product.stock}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Placeholder SVG shown when no image is available ────────────────────────
const IMG_PLACEHOLDER =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E` +
  `%3Crect width='200' height='200' fill='%23f1f5f9'/%3E` +
  `%3Cg transform='translate(100,85)'%3E` +
  `%3Crect x='-28' y='-22' width='56' height='44' rx='5' fill='none' stroke='%23cbd5e1' stroke-width='4'/%3E` +
  `%3Ccircle cx='0' cy='-5' r='9' fill='none' stroke='%23cbd5e1' stroke-width='4'/%3E` +
  `%3Cpolyline points='-28,22 -10,2 4,14 16,-4 28,22' fill='%23e2e8f0' stroke='%23cbd5e1' stroke-width='3' stroke-linejoin='round'/%3E` +
  `%3C/g%3E` +
  `%3Ctext x='100' y='152' text-anchor='middle' font-size='12' fill='%2394a3b8' font-family='sans-serif'%3ESin imagen%3C/text%3E` +
  `%3C/svg%3E`;


// ─── Image component with Drive URL auto-format + placeholder fallback ────────
const CatalogImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);

  // Reset error state when src changes
  React.useEffect(() => { setFailed(false); }, [src]);

  const displaySrc = failed || !src ? IMG_PLACEHOLDER : formatImageUrl(src);

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

// ─── Bulk Preview Table ───────────────────────────────────────────────────────
const BulkPreviewTable: React.FC<{
  rows: CatalogProduct[];
  errors: number[];
  onRemove: (i: number) => void;
}> = ({ rows, errors, onRemove }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          {['SKU', 'Nombre', 'Precio', 'Stock', 'Categoría'].map(h => (
            <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold whitespace-nowrap">{h}</th>
          ))}
          <th className="px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={`border-b border-slate-100 last:border-0 ${errors.includes(i) ? 'bg-red-50' : ''}`}>
            <td className="px-3 py-2 font-mono text-slate-600">{row.sku}</td>
            <td className="px-3 py-2 font-medium text-slate-800 max-w-[120px] truncate">{row.name}</td>
            <td className="px-3 py-2 text-ferry-600 font-semibold">${row.price.toLocaleString()}</td>
            <td className="px-3 py-2 text-slate-500">{row.stock}</td>
            <td className="px-3 py-2 text-slate-500">{row.category}</td>
            <td className="px-2 py-2">
              <button onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const CatalogManager: React.FC<Props> = ({ storeId, storeName, onClose }) => {
  const [tab, setTab] = useState<Tab>('list');

  // Catalog list
  const [catalogItems, setCatalogItems] = useState<CatalogProductStored[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Manual form
  const [form, setForm] = useState<CatalogProduct>(EMPTY_FORM);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'file'>('url');
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // Bulk upload
  const [bulkRows, setBulkRows] = useState<CatalogProduct[]>([]);
  const [bulkErrors, setBulkErrors] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal & edit mode
  const [previewItem, setPreviewItem] = useState<CatalogProductStored | null>(null);
  const [editingSku, setEditingSku] = useState<string | null>(null);

  // Families
  const [families, setFamilies] = useState<string[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [showFamiliesModal, setShowFamiliesModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');

  // Search & price filter
  const [searchQuery, setSearchQuery] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  // Drag & drop
  const [draggedSku, setDraggedSku] = useState<string | null>(null);
  const [dragOverFamily, setDragOverFamily] = useState<string | null>(null);

  // Google Sheets
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsPreview, setSheetsPreview] = useState<CatalogProduct[]>([]);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsSuccess, setSheetsSuccess] = useState(false);
  const [sheetsPasteText, setSheetsPasteText] = useState('');
  const [headersCopied, setHeadersCopied] = useState(false);
  const [sheetsMode, setSheetsMode] = useState<'paste' | 'url'>('paste');
  const [linkedUrl, setLinkedUrl] = useState(() => localStorage.getItem(`ferry_sheets_url_${storeId}`) || '');
  // sheetsUrl still used for the URL input field in url mode (before linking)

  // ── Load catalog ────────────────────────────────────────────────────────────
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const items = await getStoreCatalogProducts(storeId);
      setCatalogItems(items.sort((a, b) => a.name.localeCompare(b.name)));
    } catch { /* silent */ }
    finally { setLoadingCatalog(false); }
  }, [storeId]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ── Load families from stores/{storeId} ────────────────────────────────────
  // ── Load families from stores API ─────────────────────────────────────────────────────────────────────────
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
  const getToken = () => localStorage.getItem('access_token');

  useEffect(() => {
    const load = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_URL}/stores/${storeId}/families`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setFamilies(data.families || []);
        }
      } catch { /* silent */ }
    };
    load();
  }, [storeId]);

  const saveFamilies = async (updated: string[]) => {
    try {
      const token = getToken();
      await fetch(`${API_URL}/stores/${storeId}/families`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ families: updated }),
      });
    } catch { /* silent */ }
  };

  const handleAddFamily = async () => {
    const name = newFamilyName.trim();
    if (!name || families.includes(name)) return;
    const updated = [...families, name];
    setFamilies(updated);
    setNewFamilyName('');
    await saveFamilies(updated);
  };

  const handleDeleteFamily = async (name: string) => {
    const updated = families.filter(f => f !== name);
    setFamilies(updated);
    if (selectedFamily === name) setSelectedFamily('all');
    await saveFamilies(updated);
  };

  const handleDropOnFamily = async (targetFamily: string) => {
    if (!draggedSku) return;
    const item = catalogItems.find(i => i.sku === draggedSku);
    setDraggedSku(null);
    setDragOverFamily(null);
    if (!item || item.family === targetFamily) return;
    // Optimistic update
    setCatalogItems(prev => prev.map(i => i.sku === draggedSku ? { ...i, family: targetFamily } : i));
    try {
      await upsertProducts(storeId, [{ ...item, family: targetFamily }]);
    } catch { await loadCatalog(); } // revert on error
  };

  // ── Image upload via API (base64) ────────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setManualError('Solo se aceptan imágenes.'); return; }
    if (file.size > 5 * 1024 * 1024) { setManualError('La imagen no puede superar 5 MB.'); return; }
    setImageUploading(true); setManualError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = getToken();
      const res = await fetch(`${API_URL}/catalog/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ base64, filename: file.name }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(f => ({ ...f, image: data.url }));
      } else {
        setManualError('Error al subir la imagen.');
      }
    } catch {
      setManualError('Error al subir la imagen. Intenta de nuevo.');
    } finally { setImageUploading(false); }
  };

  // ── Load item into form for editing ────────────────────────────────────────
  const handleEdit = (item: CatalogProductStored) => {
    setForm({
      sku: item.sku, name: item.name, price: item.price, stock: item.stock,
      category: item.category, description: item.description, image: item.image,
      isOnOffer: item.isOnOffer ?? false, discountPercent: item.discountPercent ?? 0,
      family: item.family || '',
    });
    setEditingSku(item.sku);
    setImageMode('url');
    setManualError(null);
    setManualSuccess(false);
    setTab('manual');
  };

  // ── Manual submit ───────────────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.name) { setManualError('SKU y Nombre son obligatorios.'); return; }
    setManualLoading(true); setManualError(null);
    try {
      await upsertProducts(storeId, [form]);
      setManualSuccess(true);
      setForm(EMPTY_FORM);
      setEditingSku(null);
      await loadCatalog();
      setTimeout(() => { setManualSuccess(false); setTab('list'); }, 2000);
    } catch (err: any) {
      setManualError(err.message || 'Error al guardar.');
    } finally { setManualLoading(false); }
  };

  // Hack for CSV data that was saved as an Excel file with everything in one column
  const processRawData = (raw: Record<string, any>[]) => {
    if (raw.length > 0) {
      const keys = Object.keys(raw[0]);
      if (keys.length === 1 && (keys[0].includes(',') || keys[0].includes(';'))) {
        const csvStr = [keys[0], ...raw.map(r => r[keys[0]])].join('\n');
        const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
        return parsed.data as Record<string, any>[];
      }
    }
    return raw;
  };

  // ── Parse file (CSV or XLSX) ────────────────────────────────────────────────
  const parseFile = (file: File) => {
    setBulkError(null); setBulkRows([]); setBulkErrors([]);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          let raw = results.data as Record<string, any>[];
          raw = processRawData(raw);
          const normalized = raw.map(normalizeRow);
          const valid = normalized.filter(Boolean) as CatalogProduct[];
          const errIdx = normalized.reduce<number[]>((acc, r, i) => { if (!r) acc.push(i); return acc; }, []);
          setBulkRows(valid); setBulkErrors(errIdx);
          if (valid.length === 0) setBulkError('No se encontraron filas válidas. Verifica que el archivo tenga columnas: sku, nombre, precio, stock.');
        },
        error: () => setBulkError('Error al leer el archivo CSV.'),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          let raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
          raw = processRawData(raw);
          const normalized = raw.map(normalizeRow);
          const valid = normalized.filter(Boolean) as CatalogProduct[];
          const errIdx = normalized.reduce<number[]>((acc, r, i) => { if (!r) acc.push(i); return acc; }, []);
          setBulkRows(valid); setBulkErrors(errIdx);
          if (valid.length === 0) setBulkError('No se encontraron filas válidas.');
        } catch { setBulkError('Error al leer el archivo Excel.'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setBulkError('Solo se aceptan archivos .csv, .xlsx o .xls');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, []);

  // ── Duplicate confirmation modal state ──────────────────────────────────────
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    isOpen: boolean;
    duplicates: CatalogProduct[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // ── Handle Uploads with Duplicate Checks ────────────────────────────────────
  const executeBulkUpload = async (rows: CatalogProduct[]) => {
    setBulkLoading(true); setBulkError(null);
    try {
      await upsertProducts(storeId, rows);
      setBulkSuccess(true); setBulkRows([]);
      await loadCatalog();
      setTimeout(() => { setBulkSuccess(false); setTab('list'); }, 2500);
    } catch (err: any) {
      setBulkError(err.message || 'Error al guardar productos.');
    } finally { setBulkLoading(false); }
  };

  const handleBulkUpload = async () => {
    if (bulkRows.length === 0) return;
    
    const existingSkus = new Set(catalogItems.map(item => item.sku));
    const duplicates = bulkRows.filter(row => existingSkus.has(row.sku));
    if (duplicates.length > 0) {
      setDuplicateConfirm({
        isOpen: true,
        duplicates,
        onConfirm: () => { setDuplicateConfirm(null); executeBulkUpload(bulkRows); },
        onCancel: () => setDuplicateConfirm(null)
      });
      return;
    }
    executeBulkUpload(bulkRows);
  };

  // ── Google Sheets fetch ─────────────────────────────────────────────────────
  const handleSheetsFetch = async () => {
    const url = linkedUrl.trim() || sheetsUrl.trim();
    if (!url) return;
    setSheetsLoading(true); setSheetsError(null); setSheetsPreview([]);
    try {
      const csvText = await fetchGoogleSheetCsv(url);
      const results = Papa.parse<Record<string, any>>(csvText, { header: true, skipEmptyLines: true });
      let raw = results.data as Record<string, any>[];
      raw = processRawData(raw);
      const valid = raw.map(normalizeRow).filter(Boolean) as CatalogProduct[];
      if (valid.length === 0) throw new Error('No se encontraron productos válidos en la hoja.');
      setSheetsPreview(valid);
      // Persist the linked URL
      localStorage.setItem(`ferry_sheets_url_${storeId}`, url);
      setLinkedUrl(url);
    } catch (err: any) {
      setSheetsError(err.message || 'Error al leer la hoja.');
    } finally { setSheetsLoading(false); }
  };

  const executeSheetsImport = async (rows: CatalogProduct[]) => {
    setSheetsLoading(true);
    try {
      await upsertProducts(storeId, rows);
      setSheetsSuccess(true); setSheetsPreview([]); setSheetsUrl(''); setSheetsPasteText(''); setSheetsError(null);
      await loadCatalog();
      setTimeout(() => { setSheetsSuccess(false); setTab('list'); }, 2500);
    } catch (err: any) {
      setSheetsError(err.message || 'Error al importar.');
    } finally { setSheetsLoading(false); }
  };

  const handleSheetsImport = async () => {
    if (sheetsPreview.length === 0) return;

    const existingSkus = new Set(catalogItems.map(item => item.sku));
    const duplicates = sheetsPreview.filter(row => existingSkus.has(row.sku));
    if (duplicates.length > 0) {
      setDuplicateConfirm({
        isOpen: true,
        duplicates,
        onConfirm: () => { setDuplicateConfirm(null); executeSheetsImport(sheetsPreview); },
        onCancel: () => setDuplicateConfirm(null)
      });
      return;
    }
    executeSheetsImport(sheetsPreview);
  };

  // ── Copy headers to clipboard ───────────────────────────────────────────────
  const SHEET_HEADERS = 'sku\tnombre\tprecio\tstock\tcategoria\tdescripcion\timagen';
  const handleCopyHeaders = async () => {
    try {
      await navigator.clipboard.writeText(SHEET_HEADERS);
      setHeadersCopied(true);
      setTimeout(() => setHeadersCopied(false), 2000);
    } catch { /* fallback: just show text */ }
  };

  // ── Parse pasted TSV ────────────────────────────────────────────────────────
  const handleSheetsPaste = (text: string) => {
    setSheetsPasteText(text);
    setSheetsError(null);
    setSheetsPreview([]);
    if (!text.trim()) return;
    const results = Papa.parse<Record<string, any>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
    });
    let raw = results.data as Record<string, any>[];
    raw = processRawData(raw);
    const valid = raw.map(normalizeRow).filter(Boolean) as CatalogProduct[];
    if (valid.length === 0) {
      setSheetsError('No se encontraron productos válidos. Verifica que la primera fila tenga los encabezados.');
    } else {
      setSheetsPreview(valid);
    }
  };

  // ── Delete product ──────────────────────────────────────────────────────────
  const handleDelete = async (sku: string) => {
    if (!confirm(`¿Eliminar el producto con SKU ${sku}?`)) return;
    try {
      await deleteCatalogProduct(storeId, sku);
      setCatalogItems(prev => prev.filter(p => p.sku !== sku));
    } catch { /* silent */ }
  };

  // ── Tab styles ──────────────────────────────────────────────────────────────
  const tabCls = (t: Tab) =>
    `flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
      tab === t ? 'bg-ferry-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 text-sm leading-tight">Gestión de Catálogo</h2>
          <p className="text-xs text-slate-400">{storeName}</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg font-medium">
          {catalogItems.length} productos
        </span>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 px-3 py-2 bg-white border-b border-slate-100">
        <button className={tabCls('list')} onClick={() => setTab('list')}>
          <Package className="w-3.5 h-3.5" /> Catálogo
        </button>
        <button className={tabCls('manual')} onClick={() => setTab('manual')}>
          <Plus className="w-3.5 h-3.5" /> Manual
        </button>
        <button className={tabCls('bulk')} onClick={() => setTab('bulk')}>
          <Upload className="w-3.5 h-3.5" /> Excel/CSV
        </button>
        <button className={tabCls('sheets')} onClick={() => setTab('sheets')}>
          <Link2 className="w-3.5 h-3.5" /> Google Sheets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">

        {/* ── LIST TAB ──────────────────────────────────────────────────────── */}
        {tab === 'list' && (
          <div>
            {/* Header row */}
            <div className="flex justify-between items-center mb-3">
              <button onClick={loadCatalog} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCatalog ? 'animate-spin' : ''}`} /> Actualizar
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFamiliesModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" /> Familias
                </button>
                <button onClick={() => setTab('manual')} className="flex items-center gap-1.5 px-3 py-1.5 bg-ferry-500 text-white text-xs font-semibold rounded-lg">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
            </div>

            {/* Family filter tabs — also drop targets */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 pb-1">
              <button
                onClick={() => setSelectedFamily('all')}
                onDragOver={e => { e.preventDefault(); setDragOverFamily('all'); }}
                onDragLeave={() => setDragOverFamily(null)}
                onDrop={() => handleDropOnFamily('')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                  selectedFamily === 'all'
                    ? 'bg-ferry-500 text-white border-ferry-500'
                    : dragOverFamily === 'all'
                    ? 'border-ferry-400 bg-ferry-50 text-ferry-600'
                    : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {families.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFamily(f)}
                  onDragOver={e => { e.preventDefault(); setDragOverFamily(f); }}
                  onDragLeave={() => setDragOverFamily(null)}
                  onDrop={() => handleDropOnFamily(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                    selectedFamily === f
                      ? 'bg-ferry-500 text-white border-ferry-500'
                      : dragOverFamily === f
                      ? 'border-ferry-400 bg-ferry-50 text-ferry-600 scale-105'
                      : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Search + price filter bar */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchQuery(searchQuery)}
                  onBlur={() => setTimeout(() => setSearchQuery(q => q), 150)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-ferry-400"
                />
                {/* Suggestions dropdown */}
                {searchQuery.length >= 1 && (() => {
                  const q = searchQuery.toLowerCase();
                  const hits = catalogItems
                    .filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
                    .slice(0, 6);
                  if (hits.length === 0) return null;
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      {hits.map(item => (
                        <button
                          key={item.sku}
                          onMouseDown={() => setSearchQuery(item.name)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ferry-50 transition-colors text-left border-b border-slate-50 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <CatalogImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{item.sku} · ${item.price.toLocaleString()}</p>
                          </div>
                          {item.family && (
                            <span className="text-[9px] font-bold text-ferry-500 bg-ferry-50 px-1.5 py-0.5 rounded-full shrink-0">{item.family}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => setShowPriceFilter(v => !v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  showPriceFilter || priceMin || priceMax
                    ? 'bg-ferry-50 border-ferry-300 text-ferry-600'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Precio
              </button>
            </div>
            {showPriceFilter && (
              <div className="flex gap-2 mb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input
                    type="number" min="0"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    placeholder="Mín"
                    className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-ferry-400"
                  />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input
                    type="number" min="0"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    placeholder="Máx"
                    className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-ferry-400"
                  />
                </div>
                {(priceMin || priceMax) && (
                  <button onClick={() => { setPriceMin(''); setPriceMax(''); }} className="px-2 text-slate-400 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Drag hint */}
            {families.length > 0 && draggedSku && (
              <p className="text-center text-xs text-ferry-500 font-semibold mb-2 animate-in fade-in duration-150">
                Suelta sobre una familia para asignar el producto
              </p>
            )}

            {loadingCatalog ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-ferry-400 animate-spin" /></div>
            ) : catalogItems.length === 0 ? (
              <div className="text-center py-14">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-500">Tu catálogo está vacío</p>
                <p className="text-xs text-slate-400 mt-1">Agrega productos manualmente o importa desde Excel / Google Sheets</p>
                <button onClick={() => setTab('manual')} className="mt-4 px-5 py-2.5 bg-ferry-500 text-white text-sm font-semibold rounded-xl">
                  Agregar primer producto
                </button>
              </div>
            ) : (() => {
              const q = searchQuery.toLowerCase();
              const minP = priceMin ? parseFloat(priceMin) : null;
              const maxP = priceMax ? parseFloat(priceMax) : null;
              const visible = catalogItems.filter(item => {
                if (selectedFamily !== 'all' && item.family !== selectedFamily) return false;
                if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
                if (minP !== null && item.price < minP) return false;
                if (maxP !== null && item.price > maxP) return false;
                return true;
              });
              if (visible.length === 0) return (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Sin resultados para esa búsqueda
                </div>
              );
              return (
              <div className="space-y-2">
                {visible.map(item => (
                  <div
                    key={item.sku}
                    draggable={families.length > 0}
                    onDragStart={() => setDraggedSku(item.sku)}
                    onDragEnd={() => { setDraggedSku(null); setDragOverFamily(null); }}
                    className={`bg-white rounded-xl border p-3 flex items-center gap-3 shadow-sm transition-all ${
                      draggedSku === item.sku ? 'opacity-40 border-ferry-300 scale-95' : 'border-slate-100'
                    } ${families.length > 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                      <CatalogImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      {item.isOnOffer && item.discountPercent ? (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-full font-bold leading-none">
                          -{item.discountPercent}%
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400">{item.sku}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400">{item.category}</span>
                        {item.family && (
                          <>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] text-ferry-500 font-semibold">{item.family}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {item.isOnOffer && item.discountPercent ? (
                        <>
                          <p className="font-bold text-ferry-600 text-sm">
                            ${Math.round(item.price * (1 - item.discountPercent / 100)).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-400 line-through">${item.price.toLocaleString()}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-ferry-600 text-sm">${item.price.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">Stock: {item.stock}</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 text-slate-300 hover:text-ferry-500 hover:bg-ferry-50 rounded-lg transition-colors"
                        title="Vista previa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.sku)}
                        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              );
            })()}
          </div>
        )}

        {/* ── MANUAL TAB ────────────────────────────────────────────────────── */}
        {tab === 'manual' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              {/* Form */}
              <form onSubmit={handleManualSubmit} className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">SKU *</label>
                    <input
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder="CEM-001"
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Precio *</label>
                    <input
                      type="number" min="0"
                      value={form.price || ''}
                      onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="28500"
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del producto *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Cemento Gris Argos 50kg"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Stock</label>
                    <input
                      type="number" min="0"
                      value={form.stock || ''}
                      onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                      placeholder="100"
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Familia */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Familia
                  </label>
                  {families.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowFamiliesModal(true)}
                      className="w-full mt-1 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-ferry-400 hover:text-ferry-500 transition-colors flex items-center justify-center gap-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Crear familias primero
                    </button>
                  ) : (
                    <select
                      value={form.family || ''}
                      onChange={e => setForm(f => ({ ...f, family: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    >
                      <option value="">Sin familia</option>
                      {families.map(fam => <option key={fam} value={fam}>{fam}</option>)}
                    </select>
                  )}
                </div>

                {/* Imagen — URL o archivo */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Imagen</label>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                      <button type="button" onClick={() => setImageMode('url')}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-all ${imageMode === 'url' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`}>
                        URL
                      </button>
                      <button type="button" onClick={() => setImageMode('file')}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-all ${imageMode === 'file' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`}>
                        Archivo
                      </button>
                    </div>
                  </div>

                  {imageMode === 'url' ? (
                    <input
                      value={form.image}
                      onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                    />
                  ) : (
                    <div
                      onClick={() => imageFileRef.current?.click()}
                      className={`relative h-20 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all overflow-hidden
                        ${form.image ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-ferry-400 hover:bg-slate-50'}`}
                    >
                      {imageUploading ? (
                        <div className="flex flex-col items-center gap-1">
                          <Loader2 className="w-5 h-5 text-ferry-400 animate-spin" />
                          <span className="text-xs text-slate-400">Subiendo...</span>
                        </div>
                      ) : form.image ? (
                        <>
                          <img src={form.image} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-semibold">Cambiar foto</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-xs font-medium">Toca para subir</span>
                          <span className="text-[10px]">JPG, PNG, WEBP · máx 5 MB</span>
                        </div>
                      )}
                      <input
                        ref={imageFileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
                      />
                    </div>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Breve descripción del producto..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent resize-none"
                  />
                </div>

                {/* Oferta / Descuento */}
                <div className={`rounded-xl border-2 transition-colors ${form.isOnOffer ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isOnOffer: !f.isOnOffer, discountPercent: f.isOnOffer ? 0 : f.discountPercent || 10 }))}
                    className="w-full flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className={`w-4 h-4 ${form.isOnOffer ? 'text-red-500' : 'text-slate-400'}`} />
                      <span className={`text-sm font-semibold ${form.isOnOffer ? 'text-red-700' : 'text-slate-600'}`}>
                        Producto en oferta
                      </span>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors relative ${form.isOnOffer ? 'bg-red-500' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isOnOffer ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </button>

                  {form.isOnOffer && (
                    <div className="px-3 pb-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-red-400 uppercase">% de descuento</label>
                        <div className="relative mt-1">
                          <input
                            type="number" min="1" max="99"
                            value={form.discountPercent || ''}
                            onChange={e => setForm(f => ({ ...f, discountPercent: Math.min(99, Math.max(1, parseInt(e.target.value) || 0)) }))}
                            className="w-full pl-3 pr-8 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                          />
                          <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400" />
                        </div>
                      </div>
                      {form.price > 0 && form.discountPercent ? (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-400 line-through">${form.price.toLocaleString()}</p>
                          <p className="text-sm font-bold text-red-600">
                            ${Math.round(form.price * (1 - form.discountPercent / 100)).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-green-600 font-semibold">Precio final</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {manualError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600">{manualError}</p>
                  </div>
                )}

                {editingSku && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-xs text-blue-700 font-semibold">Editando: <span className="font-mono">{editingSku}</span></p>
                    </div>
                    <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingSku(null); setManualError(null); }}
                      className="text-xs text-blue-400 hover:text-blue-600 font-medium">
                      Cancelar
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full py-3 bg-ferry-500 text-white font-bold rounded-xl text-sm hover:bg-ferry-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {manualLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : manualSuccess
                    ? <><Check className="w-4 h-4" /> ¡{editingSku ? 'Actualizado' : 'Guardado'}!</>
                    : editingSku ? 'Actualizar producto' : 'Guardar producto'}
                </button>
              </form>

              {/* Live Preview */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Preview
                </p>
                <ProductPreviewCard product={form} />
              </div>
            </div>
          </div>
        )}

        {/* ── BULK UPLOAD TAB ───────────────────────────────────────────────── */}
        {tab === 'bulk' && (
          <div className="space-y-4">
            {/* Download template */}
            <button
              onClick={downloadCsvTemplate}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 font-medium hover:border-ferry-400 hover:text-ferry-600 transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar plantilla CSV de ejemplo
            </button>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-ferry-500 bg-ferry-50'
                  : 'border-slate-200 bg-white hover:border-ferry-400 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className={`w-8 h-8 mb-2 ${isDragging ? 'text-ferry-500' : 'text-slate-300'}`} />
              <p className="text-sm font-semibold text-slate-500">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o toca aquí'}
              </p>
              <p className="text-xs text-slate-400 mt-1">.csv, .xlsx, .xls</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
              />
            </div>

            {/* Especificaciones requeridas */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" /> Especificaciones del Archivo
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tu archivo debe tener los siguientes nombres en la primera fila (encabezados):<br/>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">sku</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">nombre</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">precio</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">stock</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">categoria</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded mr-1">descripcion</span>
                <span className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded">imagen</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                * Si usas Excel, simplemente arma tus columnas de forma normal y guarda el archivo. No necesitas preocuparte por separar los datos con comas manualmente.
              </p>
            </div>

            {bulkError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{bulkError}</p>
              </div>
            )}

            {bulkRows.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    <span className="text-green-600">{bulkRows.length} productos</span> listos para importar
                    {bulkErrors.length > 0 && <span className="text-red-500 ml-2">• {bulkErrors.length} filas ignoradas</span>}
                  </p>
                  <button onClick={() => setBulkRows([])} className="text-xs text-slate-400 hover:text-red-400">
                    Limpiar
                  </button>
                </div>
                <BulkPreviewTable
                  rows={bulkRows}
                  errors={bulkErrors}
                  onRemove={i => setBulkRows(prev => prev.filter((_, idx) => idx !== i))}
                />
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkLoading}
                  className="w-full py-3 bg-ferry-500 text-white font-bold rounded-xl text-sm hover:bg-ferry-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {bulkLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando {bulkRows.length} productos...</>
                    : bulkSuccess
                    ? <><Check className="w-4 h-4" /> ¡Importado exitosamente!</>
                    : `Importar ${bulkRows.length} productos al catálogo`}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── GOOGLE SHEETS TAB ─────────────────────────────────────────────── */}
        {tab === 'sheets' && (
          <div className="space-y-4">

            {/* Mode toggle */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setSheetsMode('paste'); setSheetsPreview([]); setSheetsError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                  sheetsMode === 'paste' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" /> Pegar datos
              </button>
              <button
                onClick={() => { setSheetsMode('url'); setSheetsPreview([]); setSheetsError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                  sheetsMode === 'url' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" /> Enlazar hoja
              </button>
            </div>

            {/* ── PASTE MODE ── */}
            {sheetsMode === 'paste' && (
              <>
                {/* Step 1 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ferry-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs font-semibold text-slate-700">Copia los encabezados en tu Google Sheet</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <code className="text-[11px] text-slate-600 flex-1 overflow-x-auto whitespace-nowrap">
                      sku · nombre · precio · stock · categoria · descripcion · imagen
                    </code>
                    <button
                      onClick={handleCopyHeaders}
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        headersCopied ? 'bg-green-100 text-green-700' : 'bg-ferry-500 text-white hover:bg-ferry-600'
                      }`}
                    >
                      {headersCopied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ferry-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs font-semibold text-slate-700">Selecciona todos los datos y pega aquí</p>
                  </div>
                  <p className="text-xs text-slate-500">En tu hoja: Ctrl+A → Ctrl+C → pega abajo</p>
                  <textarea
                    value={sheetsPasteText}
                    onChange={e => handleSheetsPaste(e.target.value)}
                    onPaste={e => { e.preventDefault(); handleSheetsPaste(e.clipboardData.getData('text')); }}
                    placeholder="Pega aquí el contenido copiado de Google Sheets o Excel..."
                    rows={5}
                    className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent resize-none transition-colors ${
                      sheetsPreview.length > 0 ? 'border-green-300 bg-green-50' : 'border-slate-200'
                    }`}
                  />
                </div>
              </>
            )}

            {/* ── URL MODE ── */}
            {sheetsMode === 'url' && (
              <div className="space-y-3">
                {linkedUrl ? (
                  /* Already linked */
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-800">Hoja enlazada</p>
                        <p className="text-[11px] text-green-600 truncate mt-0.5">{linkedUrl}</p>
                      </div>
                      <button
                        onClick={() => { localStorage.removeItem(`ferry_sheets_url_${storeId}`); setLinkedUrl(''); setSheetsPreview([]); }}
                        className="text-green-400 hover:text-red-400 transition-colors shrink-0"
                        title="Desenlazar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={handleSheetsFetch}
                      disabled={sheetsLoading}
                      className="w-full py-2.5 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {sheetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sincronizar ahora
                    </button>
                  </div>
                ) : (
                  /* No link yet */
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Pega el enlace de tu Google Sheet</p>
                    <p className="text-[11px] text-slate-500">
                      La hoja debe estar publicada: <strong>Archivo → Compartir → Publicar en la web → CSV</strong>
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={sheetsUrl}
                        onChange={e => { setSheetsUrl(e.target.value); setSheetsError(null); setSheetsPreview([]); }}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleSheetsFetch}
                      disabled={sheetsLoading || !sheetsUrl.trim()}
                      className="w-full py-2.5 bg-ferry-500 text-white font-semibold text-sm rounded-xl hover:bg-ferry-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {sheetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Enlazar y sincronizar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Errors & preview (shared) */}
            {sheetsError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{sheetsError}</p>
              </div>
            )}

            {sheetsPreview.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    <span className="text-green-600">{sheetsPreview.length} productos</span> detectados — revisa antes de importar
                  </p>
                  <button onClick={() => { setSheetsPreview([]); setSheetsPasteText(''); setSheetsError(null); }}
                    className="text-xs text-slate-400 hover:text-red-400">Limpiar</button>
                </div>
                <BulkPreviewTable
                  rows={sheetsPreview}
                  errors={[]}
                  onRemove={i => setSheetsPreview(prev => prev.filter((_, idx) => idx !== i))}
                />
                <button
                  onClick={handleSheetsImport}
                  disabled={sheetsLoading}
                  className="w-full py-3 bg-ferry-500 text-white font-bold rounded-xl text-sm hover:bg-ferry-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {sheetsLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    : sheetsSuccess
                    ? <><Check className="w-4 h-4" /> ¡Importado!</>
                    : `Importar ${sheetsPreview.length} productos al catálogo`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── FAMILIES MODAL ──────────────────────────────────────────────────── */}
      {showFamiliesModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-5 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-ferry-500" /> Gestionar Familias
              </h3>
              <button onClick={() => setShowFamiliesModal(false)} className="p-1.5 rounded-full hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Add new family */}
            <div className="flex gap-2 mb-4">
              <input
                value={newFamilyName}
                onChange={e => setNewFamilyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddFamily()}
                placeholder="Ej: Herrajes Cocina, Closets, Puertas..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400"
              />
              <button
                onClick={handleAddFamily}
                disabled={!newFamilyName.trim()}
                className="px-3 py-2 bg-ferry-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-ferry-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Existing families */}
            {families.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">Aún no hay familias creadas</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                {families.map(f => (
                  <div key={f} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-ferry-400" />
                      <span className="text-sm font-medium text-slate-700">{f}</span>
                      <span className="text-[10px] text-slate-400">
                        ({catalogItems.filter(i => i.family === f).length} productos)
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFamily(f)}
                      className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowFamiliesModal(false)}
              className="w-full mt-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ───────────────────────────────────────────────────── */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            <div className="h-52 bg-slate-100 relative flex items-center justify-center">
              <CatalogImage src={previewItem.image} alt={previewItem.name} className="w-full h-full object-cover" />
              {previewItem.isOnOffer && previewItem.discountPercent ? (
                <span className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                  -{previewItem.discountPercent}%
                </span>
              ) : null}
              <span className="absolute top-3 left-3 bg-slate-800/70 text-white text-xs px-2 py-1 rounded font-mono">
                {previewItem.sku}
              </span>
            </div>
            {/* Info */}
            <div className="p-5 space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">{previewItem.category}</span>
                <h3 className="font-bold text-slate-800 text-base leading-tight mt-0.5">{previewItem.name}</h3>
                {previewItem.description ? (
                  <p className="text-xs text-slate-500 mt-1">{previewItem.description}</p>
                ) : null}
              </div>
              <div className="flex items-end justify-between">
                <div>
                  {previewItem.isOnOffer && previewItem.discountPercent ? (
                    <>
                      <p className="text-ferry-600 font-bold text-2xl">
                        ${Math.round(previewItem.price * (1 - previewItem.discountPercent / 100)).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-400 line-through">${previewItem.price.toLocaleString()}</p>
                    </>
                  ) : (
                    <p className="text-ferry-600 font-bold text-2xl">${previewItem.price.toLocaleString()}</p>
                  )}
                </div>
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                  Stock: {previewItem.stock}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { handleEdit(previewItem); setPreviewItem(null); }}
                  className="flex-1 py-2.5 bg-ferry-500 text-white font-semibold text-sm rounded-xl hover:bg-ferry-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DUPLICATE CONFIRM MODAL ───────────────────────────────────────────── */}
      {duplicateConfirm && duplicateConfirm.isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          onClick={duplicateConfirm.onCancel}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Productos repetidos</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Tienes <span className="font-bold text-amber-600">{duplicateConfirm.duplicates.length}</span> producto(s) en este archivo que ya existen en tu catálogo (Ej. SKU: <span className="font-mono bg-slate-100 px-1 rounded">{duplicateConfirm.duplicates[0]?.sku}</span>).
              <br/><br/>
              ¿Quieres reemplazarlos y actualizar su información?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={duplicateConfirm.onCancel}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={duplicateConfirm.onConfirm}
                className="flex-1 py-3 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-colors"
              >
                Reemplazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogManager;
