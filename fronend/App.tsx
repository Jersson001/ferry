import React, { useState, useEffect } from 'react';
import { MaterialFlow } from './views/MaterialFlow';
import { ProjectHub } from './views/ProjectHub';
import { AdminPanel } from './views/AdminPanel';
import { StorePanel } from './views/StorePanel';
import { HomeView } from './views/HomeView';
import { UserQuotesInbox } from './src/views/UserQuotesInbox';
import { UnifiedProfile } from './views/UnifiedProfile';
import { UserRole, MaterialRequest, RequestStatus, Quote, Product, QuoteLineItem } from './types';
import { Home, ShoppingBag, Briefcase, User, CheckCircle2, Truck } from 'lucide-react';
import { Button } from './components/UIComponents';

// --- PANTALLA DE BIENVENIDA Y LOGIN (V2) ---
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setStep(1), 2500); // 2.5 segundos de logo
    return () => clearTimeout(timer);
  }, []);

  if (step === 0) {
    return (
      <div className="h-screen bg-ferry-500 flex items-center justify-center flex-col animate-in fade-in duration-700">
        <div className="bg-white p-4 rounded-3xl shadow-2xl animate-bounce">
          <Truck className="w-16 h-16 text-slate-900" />
        </div>
        <h1 className="text-white font-black text-4xl mt-6 italic tracking-tighter animate-pulse">FERRY</h1>
        <p className="text-white/90 font-medium mt-2">Cargando ecosistema...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col p-6 animate-in slide-in-from-bottom-10 duration-700">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-32 h-32 bg-ferry-50 rounded-full flex items-center justify-center mb-4 ring-4 ring-ferry-100 relative">
          <Truck className="w-16 h-16 text-ferry-600 relative z-10" />
        </div>

        <h2 className="text-3xl font-bold text-slate-800 leading-tight">
          Construye mejor <br /> <span className="text-ferry-600">sin complicaciones</span>
        </h2>
        <p className="text-slate-500 px-4">
          Conecta tu obra con los mejores proveedores y contratistas verificados.
        </p>

        <div className="w-full space-y-3 pt-4 text-left">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <CheckCircle2 className="text-green-500 w-5 h-5" />
            <span className="text-sm text-slate-600 font-medium">Cotiza materiales con una foto</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <CheckCircle2 className="text-green-500 w-5 h-5" />
            <span className="text-sm text-slate-600 font-medium">Contrata mano de obra experta</span>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pb-8">
        <Button onClick={onLogin} className="w-full py-4 text-lg shadow-xl shadow-ferry-200">
          Ingresar a Ferry
        </Button>
        <p className="text-center text-xs text-slate-400">Versión 2.0 Beta</p>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'ADMIN' | 'QUOTES'>('HOME');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.USER);

  // 1. Estado para guardar la ubicación del usuario (Latitud y Longitud)
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Estados de Datos
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  // 2. Agregamos coordenadas (lat, lng) a los productos de prueba para simular ubicaciones
  const [products, setProducts] = useState<Product[]>([
    { id: 'p1', storeId: 'store1', name: 'Cemento Gris Argos 50kg', price: 28500, stock: 45, category: 'Obra Civil', description: 'Cemento de uso general.', image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&q=80&w=200', lat: 4.6097, lng: -74.0817 },
    { id: 'p2', storeId: 'store2', name: 'Tubo PVC Sanitario 4"', price: 42000, stock: 12, category: 'Plomería', description: 'Tubería certificada.', image: 'https://images.unsplash.com/photo-1596489397631-5079a491e7c5?auto=format&fit=crop&q=80&w=200', lat: 4.6200, lng: -74.0900 }
  ]);

  // 3. Fórmula de Haversine para calcular distancia en Kilómetros
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 4. Función para pedir ubicación al loguearse
  const handleLogin = () => {
    setIsLoggedIn(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          console.log("¡Ubicación capturada!", position.coords.latitude, position.coords.longitude);
        },
        (error) => console.error("Error obteniendo ubicación:", error),
        { enableHighAccuracy: true }
      );
    }
  };

  const activeRequest = requests.find(r => r.id === activeRequestId);
  const ongoingRequest = requests.find(r => r.status === RequestStatus.PENDING_QUOTES || r.status === RequestStatus.QUOTED || r.status === RequestStatus.PAID);

  // Lógica de Negocio
  const handleManualQuote = (reqId: string) => {
    setRequests(prev => {
      const req = prev.find(r => r.id === reqId);
      if (!req || req.status !== RequestStatus.PENDING_QUOTES) return prev;
      const fullItems: QuoteLineItem[] = req.items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, status: 'AVAILABLE', price: 15000 }));
      const partialItems: QuoteLineItem[] = req.items.map((i, idx) => ({ name: i.name, quantity: i.quantity, unit: i.unit, status: idx === req.items.length - 1 ? 'MISSING' : 'AVAILABLE', price: idx === req.items.length - 1 ? 0 : 12000 }));
      const quotes: Quote[] = [
        { id: 'q1', storeName: 'Ferretería El Tornillo', totalPrice: 265000, deliveryTime: '45 min', availability: `${req.items.length}/${req.items.length} ítems`, rating: 4.8, includesTransport: true, itemsDetails: fullItems },
        { id: 'q2', storeName: 'Depósito Central', totalPrice: 210000, deliveryTime: '2 horas', availability: `${req.items.length - 1}/${req.items.length} ítems`, rating: 4.5, includesTransport: false, itemsDetails: partialItems }
      ];
      return prev.map(r => r.id === reqId ? { ...r, status: RequestStatus.QUOTED, quotes } : r);
    });
  };

  const handleStoreQuote = (reqId: string, quoteDetails: Omit<Quote, 'id'>) => {
    setRequests(prev => prev.map(req => {
      if (req.id === reqId) return { ...req, status: RequestStatus.QUOTED, quotes: [...req.quotes, { ...quoteDetails, id: Date.now().toString() }] };
      return req;
    }));
  };

  const handleRequestCreate = (req: MaterialRequest) => {
    setRequests(prev => [req, ...prev]);
    setActiveRequestId(req.id);
    setTimeout(() => {
      setRequests(currentRequests => {
        const currentReq = currentRequests.find(r => r.id === req.id);
        if (currentReq && currentReq.quotes.length === 0) handleManualQuote(req.id);
        return currentRequests;
      });
    }, 4500);
  };

  const handleAcceptQuote = (reqId: string, quoteId: string) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: RequestStatus.PAID, selectedQuoteId: quoteId } : r));
  };
  const handleRejectQuote = (reqId: string, quoteId: string) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, quotes: r.quotes.filter(q => q.id !== quoteId) } : r));
  };
  const handleFinishOrder = (reqId: string, rating: number) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: RequestStatus.DELIVERED } : r));
    setActiveRequestId(null);
    setCurrentView('HOME');
  };
  const handleAddProduct = (product: Product) => setProducts(prev => [product, ...prev]);
  const handleCycleRole = () => {
    const roles = [UserRole.USER, UserRole.STORE, UserRole.ADMIN];
    setCurrentUserRole(roles[(roles.indexOf(currentUserRole) + 1) % roles.length]);
  };

  const NavItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: any }) => (
    <button onClick={() => setCurrentView(view)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === view ? 'text-ferry-600' : 'text-slate-400'}`}>
      <Icon className={`w-6 h-6 ${currentView === view ? 'fill-ferry-600/10' : ''}`} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  // --- RENDERIZADO ---
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 z-10">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentView('HOME')}>
          <div className="relative w-8 h-8 flex items-center justify-center bg-ferry-100 rounded-lg">
            <Truck className="w-5 h-5 text-ferry-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase font-sans italic relative top-1">Ferry <span className="text-ferry-500 text-xs not-italic align-top">V2</span></h1>
        </div>
        <button onClick={handleCycleRole} className="text-[10px] text-slate-500 font-medium border border-slate-200 bg-slate-50 rounded px-2 py-1 hover:bg-slate-100 transition-colors">
          {currentUserRole === UserRole.USER && 'Usuario'}
          {currentUserRole === UserRole.STORE && 'Tienda'}
          {currentUserRole === UserRole.ADMIN && 'Admin'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {currentUserRole === UserRole.ADMIN && <AdminPanel requests={requests} onManualQuote={handleManualQuote} />}
        {currentUserRole === UserRole.STORE && <StorePanel requests={requests} onSubmitQuote={handleStoreQuote} products={products} onAddProduct={handleAddProduct} />}
        {currentUserRole === UserRole.USER && (
          <>
            {currentView === 'HOME' && <HomeView userName="Jersson" ongoingRequest={ongoingRequest} products={products} onNavigate={(view) => setCurrentView(view)} onOpenRequest={(id) => { setActiveRequestId(id); setCurrentView('SHOP'); }} userLocation={userLocation} calcularDistancia={calcularDistancia} />}
            {currentView === 'SHOP' && <MaterialFlow onRequestCreate={handleRequestCreate} activeRequest={activeRequest} onAcceptQuote={handleAcceptQuote} onRejectQuote={handleRejectQuote} onBack={() => { setActiveRequestId(null); setCurrentView('HOME'); }} onFinishOrder={handleFinishOrder} onNavigate={(view) => setCurrentView(view)} />}
            {currentView === 'HUB' && <ProjectHub />}
            {currentView === 'PROFILE' && <UnifiedProfile />}
            {currentView === 'QUOTES' && <UserQuotesInbox />}
          </>
        )}
      </main>

      {currentUserRole === UserRole.USER && (
        <nav className="bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center pb-safe">
          <NavItem icon={Home} label="Inicio" view="HOME" />
          <NavItem icon={ShoppingBag} label="Materiales" view="SHOP" />
          <NavItem icon={Briefcase} label="Proyectos" view="HUB" />
          <NavItem icon={User} label="Perfil" view="PROFILE" />
        </nav>
      )}
    </div>
  );
};

export default App;