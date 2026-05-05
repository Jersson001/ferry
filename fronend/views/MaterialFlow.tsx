
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Plus, Trash2, Pencil, ShoppingCart, Truck, MapPin, Check, CheckCircle2, ArrowLeft, CreditCard, Wallet, Banknote, QrCode, Lock, Star, Hammer, Droplets, Zap, Lightbulb, PaintRoller, Key, Flame, BrickWall, ChevronDown, ChevronUp, XCircle, X, Bell, Inbox } from 'lucide-react';
import { MaterialRequest, MaterialItem, RequestStatus, Quote } from '../types';
import { analyzeMaterialImage } from '../services/geminiService';
import { Button, Card, Badge, StarRating } from '../components/UIComponents';
import { db } from '../src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Props {
  onRequestCreate: (req: MaterialRequest) => void;
  activeRequest?: MaterialRequest;
  onAcceptQuote: (reqId: string, quoteId: string) => void;
  onRejectQuote?: (reqId: string, quoteId: string) => void;
  onBack: () => void;
  onFinishOrder: (reqId: string, rating: number) => void;
  onNavigate?: (view: 'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'QUOTES') => void;
}

// ─── WAITING / NEGOTIATING SCREEN ────────────────────────────────────────────
const PROGRESS_STEPS = [
  'Notificando a las tiendas expertas en tu zona...',
  'Las tiendas están revisando tu listado de materiales...',
  'Calculando los mejores tiempos de entrega...',
];

interface WaitingProps {
  activeRequest: MaterialRequest;
  onBack: () => void;
  onNavigate?: (view: 'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'QUOTES') => void;
}

const WaitingForQuotes: React.FC<WaitingProps> = ({ activeRequest, onBack, onNavigate }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [arrivedCount, setArrivedCount] = useState(0);

  // Cycle through progress messages every 3 s
  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex(prev => (prev + 1) % PROGRESS_STEPS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Real-time listener: count quotes that have arrived for this request
  useEffect(() => {
    if (!activeRequest.id) return;
    const q = query(
      collection(db, 'quotes'),
      where('requestId', '==', activeRequest.id),
      where('status', '==', 'sent'),
    );
    const unsub = onSnapshot(q, snapshot => {
      setArrivedCount(snapshot.size);
    });
    return () => unsub();
  }, [activeRequest.id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-ferry-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-ferry-100 animate-pulse">
          <Truck className="w-8 h-8 text-ferry-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Buscando expertos...</h2>
        <p className="text-slate-500 mt-1 text-sm px-4">
          Las tiendas verificadas en tu zona están preparando tu cotización.
        </p>
      </div>

      {/* Progress card */}
      <Card className="bg-slate-50 border-slate-200 space-y-4">
        {PROGRESS_STEPS.map((step, idx) => {
          const done = idx < stepIndex;
          const active = idx === stepIndex;
          return (
            <div key={idx} className={`flex items-center gap-3 transition-opacity duration-500 ${active ? 'opacity-100' : done ? 'opacity-50' : 'opacity-25'}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done ? 'bg-green-500' : active ? 'bg-ferry-500 animate-pulse' : 'bg-slate-300'}`} />
              <p className={`text-sm ${active ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{step}</p>
              {done && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />}
            </div>
          );
        })}

        {/* Progress bar */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-ferry-500 h-1.5 rounded-full transition-all duration-[3000ms] ease-in-out"
              style={{ width: `${((stepIndex + 1) / PROGRESS_STEPS.length) * 85}%` }}
            />
          </div>
          <p className="text-xs text-center text-slate-400 mt-2">Analizando disponibilidad y precios...</p>
        </div>
      </Card>

      {/* Real-time notification: quote has arrived */}
      {arrivedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-green-800 text-sm">
                {arrivedCount === 1
                  ? '¡Experto Local ya envió una cotización!'
                  : `¡${arrivedCount} expertos ya enviaron sus cotizaciones!`}
              </p>
              <p className="text-xs text-green-600 mt-0.5">Toca para comparar y elegir la mejor opción.</p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate?.('QUOTES')}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
          >
            <Inbox className="w-4 h-4" /> Ver cotizaciones recibidas
          </Button>
        </div>
      )}

      {/* Blind bidding notice */}
      <div className="flex items-start gap-2 px-1">
        <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Los nombres de las tiendas se revelan solo al aceptar una cotización, garantizando precios justos.
        </p>
      </div>

      <Button variant="ghost" onClick={onBack} className="w-full text-slate-500">
        <ArrowLeft className="w-4 h-4" /> Cancelar espera
      </Button>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const SPECIALTIES = [
  { id: 'Plomería', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'Eléctricos', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'Obra Civil', icon: BrickWall, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'Pintura', icon: PaintRoller, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'Carpintería', icon: Hammer, color: 'text-amber-700', bg: 'bg-amber-50' },
  { id: 'Iluminación', icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-50' },
  { id: 'Cerrajería', icon: Key, color: 'text-slate-600', bg: 'bg-slate-100' },
  { id: 'Gas', icon: Flame, color: 'text-red-500', bg: 'bg-red-50' },
];

export const MaterialFlow: React.FC<Props> = ({ onRequestCreate, activeRequest, onAcceptQuote, onRejectQuote, onBack, onFinishOrder, onNavigate }) => {
  const [mode, setMode] = useState<'INITIAL' | 'SCANNING' | 'EDITING' | 'QUOTES' | 'PAYMENT' | 'TRACKING' | 'RATING'>('INITIAL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedQuoteForPayment, setSelectedQuoteForPayment] = useState<Quote | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'NEQUI' | 'CARD' | 'PSE'>('NEQUI');
  const [userRating, setUserRating] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded state for quotes breakdown
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // If we receive an active request in a specific state, sync the view mode
  React.useEffect(() => {
    if (activeRequest) {
      if (activeRequest.status === RequestStatus.PENDING_QUOTES) setMode('INITIAL');
      if (activeRequest.status === RequestStatus.QUOTED) setMode('QUOTES');
      if (activeRequest.status === RequestStatus.PAID || activeRequest.status === RequestStatus.DELIVERED) {
         if (mode !== 'RATING') {
             setMode('TRACKING');
         }
      }
    } else {
      setMode('INITIAL');
    }
  }, [activeRequest]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setMode('SCANNING');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const cleanBase64 = base64.split(',')[1];
      
      const recognizedItems = await analyzeMaterialImage(cleanBase64);
      setItems(recognizedItems);
      setIsAnalyzing(false);
      setMode('EDITING');
    };
    reader.readAsDataURL(file);
  };

  const submitRequest = () => {
    const newRequest: MaterialRequest = {
      id: Date.now().toString(),
      title: selectedCategory ? `Pedido ${selectedCategory}` : `Pedido ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      category: selectedCategory || 'General',
      items: items,
      status: RequestStatus.PENDING_QUOTES,
      quotes: []
    };
    onRequestCreate(newRequest);
    setMode('INITIAL'); 
  };

  const handleBack = () => {
    if (mode === 'EDITING') {
      setMode('INITIAL');
      setItems([]);
    } else if (mode === 'PAYMENT') {
      setMode('QUOTES');
      setSelectedQuoteForPayment(null);
    } else {
      onBack();
    }
  };

  const handleInitiatePayment = (quote: Quote) => {
    setSelectedQuoteForPayment(quote);
    setMode('PAYMENT');
  };

  const handleConfirmPayment = () => {
    if (!activeRequest || !selectedQuoteForPayment) return;
    
    setIsProcessingPayment(true);
    setTimeout(() => {
      onAcceptQuote(activeRequest.id, selectedQuoteForPayment.id);
      setIsProcessingPayment(false);
    }, 2000);
  };

  const getActiveQuote = () => {
    if (!activeRequest || !activeRequest.selectedQuoteId) return null;
    return activeRequest.quotes.find(q => q.id === activeRequest.selectedQuoteId);
  };

  if (mode === 'INITIAL' && !activeRequest) {
    return (
      <div className="space-y-6 pb-20">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Explorar Especialistas</h2>
          <div className="grid grid-cols-4 gap-3">
            {SPECIALTIES.map((spec) => (
              <button 
                key={spec.id}
                onClick={() => setSelectedCategory(selectedCategory === spec.id ? null : spec.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${selectedCategory === spec.id ? 'bg-ferry-100 ring-2 ring-ferry-500 scale-105 shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-100'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${spec.bg}`}>
                  <spec.icon className={`w-5 h-5 ${spec.color}`} />
                </div>
                <span className={`text-[10px] font-medium leading-tight text-center ${selectedCategory === spec.id ? 'text-ferry-800' : 'text-slate-600'}`}>{spec.id}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center py-4 border-t border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {selectedCategory ? `¿Qué necesitas de ${selectedCategory}?` : '¿Qué materiales necesitas?'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedCategory ? `Cotiza solo con expertos en ${selectedCategory.toLowerCase()}.` : 'Cotiza en segundos con las mejores ferreterías.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-ferry-200 hover:border-ferry-500 transition-colors bg-ferry-50 cursor-pointer">
            <Camera className="w-10 h-10 text-ferry-500 mb-3" />
            <span className="font-semibold text-ferry-700">Tomar Foto</span>
            <span className="text-xs text-center text-ferry-600/70 mt-1">A tu lista en papel</span>
          </Card>
          
          <Card onClick={() => { setItems([]); setMode('EDITING'); }} className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 hover:border-slate-400 bg-white cursor-pointer">
            <Plus className="w-10 h-10 text-slate-400 mb-3" />
            <span className="font-semibold text-slate-700">Crear Manual</span>
            <span className="text-xs text-center text-slate-500 mt-1">Escribe ítem por ítem</span>
          </Card>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  if (mode === 'INITIAL' && activeRequest && activeRequest.status === RequestStatus.PENDING_QUOTES) {
    return <WaitingForQuotes activeRequest={activeRequest} onBack={onBack} onNavigate={onNavigate} />;
  }

  if (mode === 'SCANNING') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-ferry-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-ferry-500 rounded-full border-t-transparent animate-spin"></div>
          <Camera className="absolute inset-0 m-auto w-10 h-10 text-ferry-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Analizando tu lista...</h3>
        <p className="text-slate-500 mt-2">Nuestra IA está leyendo tu letra de doctor.</p>
      </div>
    );
  }

  if (mode === 'EDITING') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold">Revisar Lista</h2>
          </div>
          <Button variant="ghost" onClick={() => setItems([...items, { name: '', quantity: '1', unit: 'und' }])} className="!p-2">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {selectedCategory && (
           <div className="mb-4">
             <Badge type="info">Categoría: {selectedCategory}</Badge>
           </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pb-24">
          {items.map((item, idx) => (
            <Card key={idx} className="flex items-center gap-3">
              <div className="flex-1 grid grid-cols-12 gap-2">
                 <input 
                    value={item.quantity} 
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].quantity = e.target.value;
                      setItems(newItems);
                    }}
                    className="col-span-3 p-2 bg-slate-50 rounded-lg text-center font-medium outline-none focus:ring-2 focus:ring-ferry-500"
                    placeholder="Cant."
                 />
                 <input 
                    value={item.unit} 
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].unit = e.target.value;
                      setItems(newItems);
                    }}
                    className="col-span-3 p-2 bg-slate-50 rounded-lg text-center text-sm outline-none focus:ring-2 focus:ring-ferry-500"
                    placeholder="Unidad"
                 />
                 <input 
                    value={item.name} 
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].name = e.target.value;
                      setItems(newItems);
                    }}
                    className="col-span-6 p-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-ferry-500"
                    placeholder="Nombre del material"
                 />
              </div>
              <div className="flex items-center gap-1">
                <button 
                  className="p-2 text-slate-400 hover:text-ferry-500 transition-colors"
                  onClick={() => {/* Podría enfocar el input correspondiente */}}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <p className="text-center text-slate-400 py-10">Agrega ítems para comenzar</p>
          )}
        </div>

        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <Button onClick={submitRequest} disabled={items.length === 0} className="w-full shadow-xl">
            {selectedCategory ? `Cotizar con expertos en ${selectedCategory}` : 'Solicitar Cotizaciones'}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'QUOTES' && activeRequest) {
    const quotesCount = activeRequest.quotes.length;

    return (
      <div className="space-y-6 pb-20">
        <div className="bg-slate-900 text-white p-6 rounded-2xl -mt-2 relative">
          <button 
            onClick={onBack} 
            className="absolute top-6 left-4 p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="ml-8">
            <h2 className="text-2xl font-bold">¡Ofertas Listas!</h2>
            <p className="text-slate-400 text-sm">{quotesCount} ferreterías respondieron.</p>
          </div>
        </div>

        <div className="space-y-4">
          {activeRequest.quotes.length === 0 ? (
             <div className="text-center py-10 opacity-60">
                <Trash2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500">No hay cotizaciones activas.</p>
             </div>
          ) : (
             activeRequest.quotes.map((quote) => (
            <Card key={quote.id} className="border-l-4 border-l-ferry-500 relative overflow-hidden transition-all">
               {quote.totalPrice < 280000 && quote.itemsDetails?.every(i => i.status === 'AVAILABLE') && (
                 <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">
                   MEJOR PRECIO
                 </div>
               )}
               
               <div className="flex justify-between items-start mb-3">
                 <div>
                   <h3 className="font-bold text-lg">{quote.storeName}</h3>
                   <div className="flex items-center gap-2">
                       <StarRating rating={quote.rating} />
                       {activeRequest.category && activeRequest.category !== 'General' && (
                           <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200">Esp. {activeRequest.category}</span>
                       )}
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-2xl font-bold text-slate-800">${quote.totalPrice.toLocaleString()}</p>
                   {quote.includesTransport && <Badge type="success">Envío Gratis</Badge>}
                 </div>
               </div>

               <div className="flex gap-4 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg">
                 <div className="flex items-center gap-1">
                   {quote.itemsDetails?.every(i => i.status === 'AVAILABLE') ? (
                       <CheckCircle2 className="w-4 h-4 text-green-600" />
                   ) : (
                       <XCircle className="w-4 h-4 text-orange-500" />
                   )}
                   {quote.availability}
                 </div>
                 <div className="flex items-center gap-1">
                   <Truck className="w-4 h-4 text-blue-600" />
                   {quote.deliveryTime}
                 </div>
               </div>

               <div className="mb-4">
                  <button 
                    onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)}
                    className="text-xs text-ferry-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    {expandedQuoteId === quote.id ? 'Ocultar Detalle' : 'Ver Detalle Cotizado'}
                    {expandedQuoteId === quote.id ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                  </button>
                  
                  {expandedQuoteId === quote.id && quote.itemsDetails && (
                      <div className="mt-3 bg-slate-50 rounded-lg p-2 text-sm space-y-2 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                          {quote.itemsDetails.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      {item.status === 'AVAILABLE' ? (
                                          <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                          <X className="w-3 h-3 text-red-500" />
                                      )}
                                      <span className={`${item.status === 'MISSING' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                          {item.quantity} {item.unit} {item.name}
                                      </span>
                                  </div>
                                  <span className="font-mono text-xs text-slate-600">
                                      {item.status === 'AVAILABLE' ? `$${(item.price || 0).toLocaleString()}` : 'Agotado'}
                                  </span>
                              </div>
                          ))}
                      </div>
                  )}
               </div>

               <div className="flex gap-2">
                 {onRejectQuote && (
                    <Button 
                        variant="ghost" 
                        onClick={() => onRejectQuote(activeRequest.id, quote.id)}
                        className="flex-1 text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100"
                    >
                        Rechazar
                    </Button>
                 )}
                 <Button onClick={() => handleInitiatePayment(quote)} className="flex-[2]">
                   Comprar
                 </Button>
               </div>
            </Card>
          )))}
        </div>
      </div>
    );
  }

  if (mode === 'PAYMENT' && selectedQuoteForPayment) {
    return (
      <div className="flex flex-col h-full bg-slate-50 -m-4 p-4 min-h-screen">
        <div className="flex items-center gap-2 mb-6 mt-2">
            <button onClick={handleBack} className="p-2 rounded-full bg-white shadow-sm hover:bg-slate-100 text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800">Pasarela de Pago</h2>
        </div>

        <Card className="mb-6 border-none shadow-md">
          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
             <div>
               <p className="text-xs text-slate-500 uppercase tracking-wide">Proveedor</p>
               <h3 className="font-bold text-lg text-slate-800">{selectedQuoteForPayment.storeName}</h3>
             </div>
             <div className="text-right">
               <p className="text-xs text-slate-500 uppercase tracking-wide">Total a Pagar</p>
               <h3 className="font-bold text-2xl text-ferry-600">${selectedQuoteForPayment.totalPrice.toLocaleString()}</h3>
             </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
             <Truck className="w-4 h-4 text-ferry-500" />
             <span>Entrega estimada: <strong>{selectedQuoteForPayment.deliveryTime}</strong></span>
          </div>
        </Card>

        <h3 className="font-bold text-slate-800 mb-3">Método de Pago</h3>
        
        <div className="space-y-3 mb-8">
           <div 
             onClick={() => setPaymentMethod('NEQUI')}
             className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'NEQUI' ? 'border-purple-600 bg-purple-50' : 'border-white bg-white shadow-sm'}`}
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-white">
                   <span className="font-bold text-xs">Nequi</span>
                 </div>
                 <span className="font-semibold text-slate-700">Nequi</span>
              </div>
              {paymentMethod === 'NEQUI' && <div className="w-4 h-4 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-600"></div>}
           </div>

           <div 
             onClick={() => setPaymentMethod('PSE')}
             className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'PSE' ? 'border-blue-600 bg-blue-50' : 'border-white bg-white shadow-sm'}`}
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                   <Banknote className="w-5 h-5" />
                 </div>
                 <span className="font-semibold text-slate-700">PSE / Bancos</span>
              </div>
              {paymentMethod === 'PSE' && <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-600"></div>}
           </div>

           <div 
             onClick={() => setPaymentMethod('CARD')}
             className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${paymentMethod === 'CARD' ? 'border-slate-800 bg-slate-100' : 'border-white bg-white shadow-sm'}`}
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white">
                   <CreditCard className="w-5 h-5" />
                 </div>
                 <span className="font-semibold text-slate-700">Tarjeta Crédito/Débito</span>
              </div>
              {paymentMethod === 'CARD' && <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-white ring-2 ring-slate-800"></div>}
           </div>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
             <Lock className="w-3 h-3" />
             Pagos procesados y protegidos por Ferry
          </div>
          <Button 
            onClick={handleConfirmPayment} 
            isLoading={isProcessingPayment}
            className={`w-full text-lg py-4 ${paymentMethod === 'NEQUI' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200' : ''}`}
          >
             Pagar ${selectedQuoteForPayment.totalPrice.toLocaleString()}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'TRACKING' && activeRequest) {
    const activeQuote = getActiveQuote();

    return (
      <div className="relative h-[calc(100vh-140px)] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={onBack} 
            className="bg-white p-3 rounded-full shadow-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute inset-0 opacity-40 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-74.0817,4.6097,14,0/600x600?access_token=Pk.mock')] bg-cover grayscale"
             style={{ backgroundImage: `repeating-linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), repeating-linear-gradient(45deg, #e5e7eb 25%, #f3f4f6 25%, #f3f4f6 75%, #e5e7eb 75%, #e5e7eb)`}}
        ></div>
        
        <div className="absolute inset-0 flex items-center justify-center">
             <div className="relative w-full h-full">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  <path d="M 120 150 Q 200 300 250 400" stroke="#f97316" strokeWidth="4" fill="none" strokeDasharray="8 4" className="animate-[dash_1s_linear_infinite]" />
                </svg>
                <style>{`@keyframes dash { to { stroke-dashoffset: -12; } }`}</style>

                <div className="absolute top-[140px] left-[110px] bg-white p-2 rounded-full shadow-lg z-10 animate-bounce">
                  <Truck className="w-6 h-6 text-ferry-600" />
                </div>
                
                <div className="absolute bottom-[200px] right-[80px] bg-slate-800 p-2 rounded-full shadow-lg z-10">
                   <MapPin className="w-6 h-6 text-white" />
                </div>
             </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 bg-white p-4 rounded-xl shadow-2xl border-t border-slate-100">
           <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                <img src="https://picsum.photos/100/100" alt="Driver" />
              </div>
              <div className="flex-1">
                 <h4 className="font-bold">Camión de {activeQuote?.storeName.split(' ')[0]}</h4>
                 <p className="text-sm text-slate-500">Llega en 12 min</p>
              </div>
              <div className="text-right">
                 <span className="block font-mono bg-slate-100 px-2 py-1 rounded text-xs">PLA-392</span>
              </div>
           </div>
           
           <div className="flex gap-2">
             <Button className="flex-1" variant="outline">Llamar</Button>
             <Button className="flex-1" onClick={() => setMode('RATING')}>Confirmar Entrega</Button>
           </div>
        </div>
      </div>
    );
  }

  if (mode === 'RATING' && activeRequest) {
    const activeQuote = getActiveQuote();

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-slate-800">¡Pedido Completado!</h2>
          <p className="text-slate-500 mt-2">¿Cómo estuvo el servicio de <span className="font-semibold text-slate-700">{activeQuote?.storeName}</span>?</p>
        </div>

        <div className="flex gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star}
              onClick={() => setUserRating(star)}
              className="focus:outline-none transform hover:scale-110 transition-transform"
            >
              <Star 
                className={`w-10 h-10 ${star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} 
              />
            </button>
          ))}
        </div>

        <textarea 
          placeholder="Escribe un comentario (opcional)..." 
          className="w-full p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-ferry-500 outline-none resize-none h-32"
        ></textarea>

        <Button 
          onClick={() => onFinishOrder(activeRequest.id, userRating)}
          disabled={userRating === 0}
          className="w-full"
        >
          Enviar Calificación
        </Button>
        
        <Button variant="ghost" onClick={() => onFinishOrder(activeRequest.id, 0)} className="w-full text-slate-400">
          Omitir
        </Button>
      </div>
    );
  }

  return null;
};
