
import React, { useState, useRef, useEffect } from 'react';
import { MaterialRequest, RequestStatus, Quote, Product, QuoteLineItem } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { Package, Clock, Truck, CheckCircle2, ChevronRight, Store, AlertCircle, ShoppingBag, Plus, Image as ImageIcon, X, Check, Calculator } from 'lucide-react';

interface Props {
  requests: MaterialRequest[];
  products: Product[];
  onSubmitQuote: (reqId: string, quote: Omit<Quote, 'id'>) => void;
  onAddProduct: (product: Product) => void;
}

export const StorePanel: React.FC<Props> = ({ requests, onSubmitQuote, products, onAddProduct }) => {
  const [activeTab, setActiveTab] = useState<'QUOTES' | 'ORDERS' | 'CATALOG'>('QUOTES');
  const [quotingRequestId, setQuotingRequestId] = useState<string | null>(null);
  
  // New Product Form State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', price: 0, stock: 1, category: 'Plomería', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);

  // Quote Form State - Expanded for Line Items
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [quoteForm, setQuoteForm] = useState({
    time: '',
    transport: true
  });

  // Derived Total Price
  const calculatedTotal = quoteItems.reduce((sum, item) => {
    return item.status === 'AVAILABLE' ? sum + (item.price || 0) : sum;
  }, 0);

  // Mock Store Identity
  const MY_STORE_NAME = "Ferretería El Tornillo";

  // Filter Logic
  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING_QUOTES);
  
  const myOrders = requests.filter(r => {
    const myQuote = r.quotes.find(q => q.storeName === MY_STORE_NAME);
    const isWon = r.selectedQuoteId && myQuote && r.selectedQuoteId === myQuote.id;
    return isWon && (r.status === RequestStatus.PAID || r.status === RequestStatus.DELIVERED);
  });

  // Initialize Quote Items when opening a request
  const handleStartQuoting = (req: MaterialRequest) => {
    setQuotingRequestId(req.id);
    setQuoteItems(req.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      status: 'AVAILABLE',
      price: 0 // Initialize price at 0
    })));
  };

  const handleItemChange = (index: number, field: keyof QuoteLineItem, value: any) => {
    const newItems = [...quoteItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If marking as missing, reset price to 0
    if (field === 'status' && value === 'MISSING') {
      newItems[index].price = 0;
    }
    setQuoteItems(newItems);
  };

  const handleSubmitQuote = () => {
    if (!quotingRequestId) return;
    
    // Calculate availability string (e.g., "4/5 ítems")
    const availableCount = quoteItems.filter(i => i.status === 'AVAILABLE').length;
    const totalCount = quoteItems.length;
    const availabilityStr = availableCount === totalCount ? 'Completo' : `${availableCount}/${totalCount} ítems`;

    onSubmitQuote(quotingRequestId, {
      storeName: MY_STORE_NAME,
      totalPrice: calculatedTotal,
      deliveryTime: quoteForm.time || '1 hora',
      availability: availabilityStr,
      rating: 4.8, 
      includesTransport: quoteForm.transport,
      itemsDetails: quoteItems
    });

    setQuotingRequestId(null);
    setQuoteForm({ time: '', transport: true });
    setQuoteItems([]);
  };

  // ... (Existing product handlers remain the same) ...
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string);
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = () => {
    if (newProduct.name && newProduct.price) {
      onAddProduct({
        id: Date.now().toString(),
        storeId: 'store1',
        name: newProduct.name,
        price: newProduct.price,
        stock: newProduct.stock || 0,
        category: newProduct.category || 'Varios',
        description: newProduct.description || '',
        image: newProduct.image || 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=200'
      });
      setIsAddingProduct(false);
      setNewProduct({ name: '', price: 0, stock: 1, category: 'Plomería', description: '' });
      setProductImagePreview(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-ferry-500 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
           </div>
           <div>
             <h2 className="text-xl font-bold">{MY_STORE_NAME}</h2>
             <div className="flex items-center gap-2 text-xs text-slate-400">
               <span className="w-2 h-2 rounded-full bg-green-500"></span> Abierto ahora
             </div>
           </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700 text-center">
           <div>
              <span className="block text-xl font-bold">{pendingRequests.length}</span>
              <span className="text-[10px] text-slate-400 uppercase">Cotizar</span>
           </div>
           <div className="border-l border-slate-700">
              <span className="block text-xl font-bold">{myOrders.length}</span>
              <span className="text-[10px] text-slate-400 uppercase">Pedidos</span>
           </div>
           <div className="border-l border-slate-700">
              <span className="block text-xl font-bold">{products.length}</span>
              <span className="text-[10px] text-slate-400 uppercase">Productos</span>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white border border-slate-200 rounded-xl">
        <button 
          onClick={() => setActiveTab('QUOTES')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'QUOTES' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Cotizar
        </button>
        <button 
          onClick={() => setActiveTab('ORDERS')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'ORDERS' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Pedidos
        </button>
        <button 
          onClick={() => setActiveTab('CATALOG')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'CATALOG' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Catálogo
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        
        {/* --- QUOTES TAB --- */}
        {activeTab === 'QUOTES' && (
           <>
             {pendingRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                   <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                   <p className="text-slate-500">No hay solicitudes pendientes.</p>
                </div>
             ) : (
                pendingRequests.map(req => (
                   <Card key={req.id} className={`transition-all ${quotingRequestId === req.id ? 'ring-2 ring-ferry-500' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <Badge type="warning">Nueva Solicitud</Badge>
                               <span className="text-xs text-slate-400">{new Date(req.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <h3 className="font-bold text-slate-800">{req.title}</h3>
                            <p className="text-xs text-slate-500">{req.category || 'Materiales Generales'}</p>
                         </div>
                      </div>

                      {quotingRequestId === req.id ? (
                         <div className="space-y-4 bg-slate-50 -mx-4 -mb-4 p-4 mt-2 border-t border-slate-200 animate-in fade-in">
                            <h4 className="font-bold text-sm text-ferry-700 flex items-center gap-2">
                               <Calculator className="w-4 h-4"/> Cotizar Materiales
                            </h4>
                            
                            {/* ITEM LIST EDITING */}
                            <div className="space-y-2">
                               {quoteItems.map((item, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${item.status === 'MISSING' ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
                                     
                                     {/* Toggle Availability */}
                                     <button 
                                       onClick={() => handleItemChange(idx, 'status', item.status === 'AVAILABLE' ? 'MISSING' : 'AVAILABLE')}
                                       className={`p-2 rounded-full transition-colors ${item.status === 'AVAILABLE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}
                                     >
                                        {item.status === 'AVAILABLE' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                     </button>

                                     {/* Name & Qty */}
                                     <div className="flex-1">
                                        <p className={`text-sm font-medium ${item.status === 'MISSING' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                           {item.name}
                                        </p>
                                        <p className="text-xs text-slate-500">{item.quantity} {item.unit}</p>
                                     </div>

                                     {/* Price Input */}
                                     <div className="w-28">
                                        {item.status === 'AVAILABLE' ? (
                                           <div className="relative">
                                             <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                                             <input 
                                                type="number" 
                                                className="w-full pl-5 pr-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-ferry-500 outline-none text-right font-semibold"
                                                placeholder="0"
                                                value={item.price === 0 ? '' : item.price}
                                                onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                                             />
                                           </div>
                                        ) : (
                                           <span className="text-xs font-bold text-red-400 block text-right pr-2">Agotado</span>
                                        )}
                                     </div>
                                  </div>
                               ))}
                            </div>

                            {/* Summary & Footer */}
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                               <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-bold text-slate-600">Total Cotización</span>
                                  <span className="text-xl font-bold text-ferry-600">${calculatedTotal.toLocaleString()}</span>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3 mb-2">
                                  <div>
                                     <label className="text-xs font-bold text-slate-500">Tiempo Entrega</label>
                                     <input 
                                       className="w-full p-2 rounded border border-slate-200 text-xs bg-slate-50"
                                       placeholder="Ej: 45 min"
                                       value={quoteForm.time}
                                       onChange={e => setQuoteForm({...quoteForm, time: e.target.value})}
                                     />
                                  </div>
                                  <div className="flex items-center">
                                     <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input 
                                          type="checkbox" 
                                          checked={quoteForm.transport}
                                          onChange={e => setQuoteForm({...quoteForm, transport: e.target.checked})}
                                          className="rounded text-ferry-600 focus:ring-ferry-500" 
                                        />
                                        Incluye transporte
                                     </label>
                                  </div>
                               </div>
                            </div>

                            <div className="flex gap-2">
                               <Button variant="ghost" onClick={() => setQuotingRequestId(null)} className="flex-1 text-sm bg-white border border-slate-200">Cancelar</Button>
                               <Button onClick={handleSubmitQuote} disabled={calculatedTotal === 0 && !quoteItems.some(i => i.status === 'MISSING')} className="flex-1 text-sm">
                                  Enviar Oferta
                               </Button>
                            </div>
                         </div>
                      ) : (
                         <>
                            <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-600 mb-3 line-clamp-2">
                               {req.items.map(i => `${i.quantity} ${i.name}`).join(', ')}
                            </div>
                            <Button onClick={() => handleStartQuoting(req)} className="w-full">
                               Cotizar Ahora
                            </Button>
                         </>
                      )}
                   </Card>
                ))
             )}
           </>
        )}

        {/* --- ORDERS TAB --- */}
        {activeTab === 'ORDERS' && (
           <>
              {myOrders.length === 0 ? (
                 <div className="text-center py-12">
                   <p className="text-slate-400">No tienes pedidos activos.</p>
                 </div>
              ) : (
                 myOrders.map(req => (
                    <Card key={req.id} className="border-l-4 border-l-green-500">
                       <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-slate-800">Pedido #{req.id.slice(-4)}</h3>
                          <Badge type="success">Pagado</Badge>
                       </div>
                       <div className="text-sm text-slate-600 mb-3">
                          <p className="flex items-center gap-1"><Clock className="w-3 h-3"/> Entregar antes de: 2:00 PM</p>
                          <p className="flex items-center gap-1"><Truck className="w-3 h-3"/> Destino: Cedritos, Calle 140...</p>
                       </div>
                       <div className="bg-slate-100 p-2 rounded text-xs font-mono text-slate-600 mb-3">
                          {req.items.length} ítems para alistar
                       </div>
                       <Button variant="outline" className="w-full text-green-700 border-green-200 hover:bg-green-50">
                          <CheckCircle2 className="w-4 h-4" /> Marcar Despachado
                       </Button>
                    </Card>
                 ))
              )}
           </>
        )}

        {/* --- CATALOG TAB (ECOMMERCE) --- */}
        {activeTab === 'CATALOG' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {!isAddingProduct ? (
              <>
                 <Button onClick={() => setIsAddingProduct(true)} className="w-full mb-4 shadow-ferry-100">
                    <Plus className="w-5 h-5" /> Publicar Producto
                 </Button>

                 <div className="grid grid-cols-2 gap-3">
                    {products.map(product => (
                       <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                          <div className="h-32 bg-slate-100 relative">
                             <img src={product.image} className="w-full h-full object-cover" alt={product.name} />
                             {product.stock < 10 && (
                                <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                                   ¡Pocas Unidades!
                                </div>
                             )}
                          </div>
                          <div className="p-3 flex-1 flex flex-col">
                             <span className="text-[10px] text-slate-400 uppercase font-bold mb-1">{product.category}</span>
                             <h4 className="font-bold text-sm text-slate-800 leading-tight mb-2 line-clamp-2">{product.name}</h4>
                             <div className="mt-auto flex justify-between items-end">
                                <span className="text-ferry-600 font-bold">${product.price.toLocaleString()}</span>
                                <span className="text-xs text-slate-500">Stock: {product.stock}</span>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
                 {products.length === 0 && (
                    <div className="text-center py-10 opacity-50">
                       <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                       <p className="text-slate-400">Tu vitrina está vacía.</p>
                    </div>
                 )}
              </>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                 <div className="flex items-center gap-2 mb-4 text-slate-800">
                    <button onClick={() => setIsAddingProduct(false)} className="p-1 -ml-1 rounded-full hover:bg-slate-100">
                       <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <h3 className="font-bold text-lg">Nuevo Producto</h3>
                 </div>

                 <div className="space-y-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-ferry-400 transition-colors overflow-hidden relative"
                    >
                       {productImagePreview ? (
                          <img src={productImagePreview} className="w-full h-full object-cover" alt="Preview" />
                       ) : (
                          <>
                             <ImageIcon className="w-8 h-8 mb-2" />
                             <span className="text-xs font-medium">Toca para subir foto</span>
                          </>
                       )}
                       <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                    </div>

                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Nombre del Producto</label>
                       <input 
                         className="w-full p-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-ferry-500 border border-slate-200"
                         placeholder="Ej: Taladro Percutor 500W"
                         value={newProduct.name}
                         onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Precio ($)</label>
                          <input 
                            type="number"
                            className="w-full p-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-ferry-500 border border-slate-200"
                            placeholder="0"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
                          />
                       </div>
                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Stock</label>
                          <input 
                            type="number"
                            className="w-full p-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-ferry-500 border border-slate-200"
                            placeholder="1"
                            value={newProduct.stock}
                            onChange={(e) => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                          />
                       </div>
                    </div>

                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                       <select 
                          className="w-full p-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-ferry-500 border border-slate-200"
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                       >
                          <option>Plomería</option>
                          <option>Electricidad</option>
                          <option>Obra Civil</option>
                          <option>Pintura</option>
                          <option>Herramientas</option>
                          <option>Varios</option>
                       </select>
                    </div>

                    <Button onClick={handleSaveProduct} disabled={!newProduct.name || !newProduct.price} className="w-full mt-2">
                       Publicar en Ferry
                    </Button>
                 </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
