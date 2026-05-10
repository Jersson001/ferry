import React, { useState, useEffect, useRef } from 'react';
import { MaterialFlow } from './views/MaterialFlow';
import { ProjectHub } from './views/ProjectHub';
import { AdminPanel } from './views/AdminPanel';
import { StorePanel } from './views/StorePanel';
import { CatalogManager } from './components/CatalogManager';
import { HomeView } from './views/HomeView';
import { UnifiedProfile } from './views/UnifiedProfile';
import { UserQuotesInbox } from './views/UserQuotesInbox';
import { LoginScreen } from './views/LoginScreen';
import { CompleteProfileScreen, isProfileIncomplete } from './views/CompleteProfileScreen';
import { UserRole, MaterialRequest, RequestStatus, Quote, Product, QuoteLineItem, UserProfile } from './types';
import { Home, ShoppingBag, Briefcase, User, CheckCircle2, Inbox, Package, ShieldAlert, X, Store, LogOut } from 'lucide-react';
import ferryLogo from './assets/logo.svg';
import { getCurrentUser, signOut as logoutUser } from './services/authService';
import { loadGuestCart, GuestCart } from './hooks/useGuestCart';


// --- APP PRINCIPAL ---

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [preselectedRole, setPreselectedRole] = useState<'constructor' | 'ferreteria' | null>(null);
  const [pendingCart, setPendingCart] = useState<GuestCart | null>(null);
  const [autoSubmitAfterLogin, setAutoSubmitAfterLogin] = useState(false);
  const [currentView, setCurrentView] = useState<'HOME' | 'SHOP' | 'HUB' | 'PROFILE' | 'ADMIN' | 'QUOTES' | 'CATALOG'>('HOME');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Controla si ya se hizo la primera verificación de sesión al cargar la app
  const authFirstCheckRef = useRef(false);

  // Estado para geolocalización del usuario
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Fórmula de Haversine para calcular distancia en Kilómetros
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const user = getCurrentUser();
    
    if (user) {
      if (!authFirstCheckRef.current) {
        setIsLoggedIn(true);
        setIsGuest(false);
      }
      setPreselectedRole(null);
      setCurrentUserProfile(prev => {
        if (prev?.uid === user.uid) return prev;
        return user;
      });
      
      // Pedir geolocalización
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          },
          (error) => console.error("Error obteniendo ubicación:", error),
          { enableHighAccuracy: true }
        );
      }
    } else {
      if (!authFirstCheckRef.current) {
        setIsLoggedIn(false);
        setCurrentUserProfile(null);
        setIsGuest(true);
      }
    }
    
    setIsAuthReady(true);
    authFirstCheckRef.current = true;
  }, []);

  // Estados de Datos
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([
    { id: 'p1', storeId: 'store1', name: 'Cemento Gris Argos 50kg', price: 28500, stock: 45, category: 'Obra Civil', description: 'Cemento de uso general.', image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&q=80&w=200', lat: 4.6097, lng: -74.0817 },
    { id: 'p2', storeId: 'store1', name: 'Tubo PVC Sanitario 4"', price: 42000, stock: 12, category: 'Plomería', description: 'Tubería certificada.', image: 'https://images.unsplash.com/photo-1596489397631-5079a491e7c5?auto=format&fit=crop&q=80&w=200', lat: 4.6584, lng: -74.0936 }
  ]);

  const [stores] = useState<UserProfile[]>([
    { uid: 'store1', displayName: 'Ferretería El Tornillo',   role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6097, lng: -74.0817, address: 'Centro, Bogotá' },         specialties: ['Depósito'] },
    { uid: 'store2', displayName: 'Mundo Fontanero',          role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6584, lng: -74.0936, address: 'Chapinero, Bogotá' },      specialties: ['Plomería'] },
    { uid: 'store3', displayName: 'Eléctricos del Norte',     role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.7110, lng: -74.0721, address: 'Suba, Bogotá' },           specialties: ['Eléctricos'] },
    { uid: 'store4', displayName: 'Luminaria & Diseño',       role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.7485, lng: -74.0452, address: 'Usaquén, Bogotá' },        specialties: ['Iluminación'] },
    { uid: 'store5', displayName: 'Carpintería La Madera',    role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6800, lng: -74.1100, address: 'Fontibón, Bogotá' },       specialties: ['Carpintería'] },
    { uid: 'store6', displayName: 'Aceros Estructurales SAS', role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6300, lng: -74.1300, address: 'Puente Aranda, Bogotá' },  specialties: ['Estructural'] },
    { uid: 'store7', displayName: 'Cerrajería Bogotá',        role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6450, lng: -74.0600, address: 'La Candelaria, Bogotá' },  specialties: ['Cerrajería'] },
    { uid: 'store8', displayName: 'Pinturas y Color SAS',     role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6700, lng: -74.0850, address: 'Teusaquillo, Bogotá' },    specialties: ['Pintura'] },
    { uid: 'store9', displayName: 'Gas & Redes Industriales', role: UserRole.STORE, createdAt: new Date(), location: { lat: 4.6950, lng: -74.1050, address: 'Engativá, Bogotá' },       specialties: ['Gas'] },
  ]);

  const activeRequest = requests.find(r => r.id === activeRequestId);
  const ongoingRequest = requests.find(r => r.status === RequestStatus.PENDING_QUOTES || r.status === RequestStatus.QUOTED || r.status === RequestStatus.PAID);
  const currentUserRole = currentUserProfile?.role || UserRole.USER;

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
  const handleFinishOrder = (reqId: string, _rating: number) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: RequestStatus.DELIVERED } : r));
    setActiveRequestId(null);
    setCurrentView('HOME');
  };
  const handleAddProduct = (product: Product) => setProducts(prev => [product, ...prev]);
  const handleCycleRole = () => {
    if (!currentUserProfile) return;
    const roles = [UserRole.USER, UserRole.STORE, UserRole.ADMIN];
    const nextRole = roles[(roles.indexOf(currentUserRole) + 1) % roles.length];
    setCurrentUserProfile({ ...currentUserProfile, role: nextRole });
  };

  const NavItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: any }) => (
    <button onClick={() => setCurrentView(view)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === view ? 'text-ferry-600' : 'text-slate-400'}`}>
      <Icon className={`w-6 h-6 ${currentView === view ? 'fill-ferry-600/10' : ''}`} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  // --- RENDERIZADO ---
  if (!isAuthReady) {
    return (
      <div className="h-screen bg-ferry-500 flex items-center justify-center flex-col">
        <div className="bg-white p-5 rounded-3xl shadow-2xl animate-bounce">
          <img src={ferryLogo} alt="Ferry" className="h-12 object-contain" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !isGuest) {
    return <LoginScreen
      preselectedRole={preselectedRole}
      onLogin={(role) => {
        setPreselectedRole(null);
        const apiUser = getCurrentUser();
        // Recuperar carrito de invitado si existía
        const savedCart = loadGuestCart();
        if (savedCart && role !== 'ferreteria') {
          setPendingCart(savedCart);
          setAutoSubmitAfterLogin(true);
          setCurrentView('SHOP');
        }
        setIsLoggedIn(true);
        setIsGuest(false);
        setCurrentUserProfile({
          uid: apiUser?.uid || 'user-' + Date.now(),
          email: apiUser?.email,
          displayName: apiUser?.displayName || (role === 'ferreteria' ? 'Mi Ferretera' : 'Usuario'),
          role: role === 'ferreteria' ? UserRole.STORE : UserRole.USER,
          createdAt: new Date(),
        });
      }}
      onGuestLogin={() => {
        setIsGuest(true);
        setCurrentUserProfile({
          uid: 'guest',
          displayName: 'Invitado',
          role: UserRole.USER,
          createdAt: new Date(),
        });
      }}
    />;
  }

  // ── Onboarding Gate: intercept users with incomplete profiles ─────────────
  // Se muestra DESPUÉS de isLoggedIn=true pero ANTES del dashboard.
  // Condición: perfil ya cargado + usuario autenticado + perfil incompleto.
  if (isLoggedIn && !isGuest && currentUserProfile && isProfileIncomplete(currentUserProfile)) {
    return (
      <CompleteProfileScreen
        profile={currentUserProfile}
        onComplete={(updated) => {
          // Actualizar estado global → App.tsx re-renderiza directo al dashboard
          setCurrentUserProfile(updated);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">

      {/* Modal de Auth Gate */}
      {showAuthGate && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowAuthGate(false)}>
          <div className="w-full bg-white rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

            {/* Carrito pendiente — mensaje motivador */}
            {loadGuestCart() ? (
              <>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">¡Tu listado está listo!</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    Inicia sesión o regístrate en segundos para enviar esta cotización a las ferreterías.
                  </p>
                  <div className="bg-ferry-50 border border-ferry-100 rounded-xl px-3 py-2 mt-3 text-xs text-ferry-700 font-medium">
                    {loadGuestCart()!.items.length} producto{loadGuestCart()!.items.length !== 1 ? 's' : ''} guardados • Tu pedido no se perderá
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-ferry-100 rounded-2xl flex items-center justify-center">
                  <User className="w-6 h-6 text-ferry-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Esta función requiere cuenta</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Regístrate gratis para continuar</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => { setShowAuthGate(false); setIsGuest(false); setCurrentUserProfile(null); }}
                className="w-full py-4 bg-ferry-500 text-white font-bold rounded-2xl hover:bg-ferry-600 transition-colors"
              >
                Crear cuenta — es gratis
              </button>
              <button
                onClick={() => { setShowAuthGate(false); setIsGuest(false); setCurrentUserProfile(null); }}
                className="w-full py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-2xl hover:border-ferry-300 transition-colors"
              >
                Ya tengo cuenta — Iniciar sesión
              </button>
              <button onClick={() => setShowAuthGate(false)} className="w-full py-2 text-slate-400 text-sm font-medium">
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner invitado */}
      {isGuest && (
        <div className="bg-ferry-500 px-4 py-2 flex items-center justify-between gap-2 z-10">
          <p className="text-white text-xs font-medium flex-1">Estás explorando como invitado</p>
          <button
            onClick={() => { setIsGuest(false); setCurrentUserProfile(null); }}
            className="text-white/90 text-xs font-bold underline whitespace-nowrap"
          >
            Crear cuenta
          </button>
        </div>
      )}

      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 z-10">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentView('HOME')}>
          <img src={ferryLogo} alt="Ferry" className="h-8 object-contain" />
          <span className="text-ferry-500 text-[10px] font-bold align-top -ml-1">V2</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCycleRole} className="text-[10px] text-slate-500 font-medium border border-slate-200 bg-slate-50 rounded px-2 py-1 hover:bg-slate-100 transition-colors">
            {currentUserRole === UserRole.USER && 'Usuario'}
            {currentUserRole === UserRole.STORE && 'Tienda'}
            {currentUserRole === UserRole.ADMIN && 'Admin'}
          </button>
          
          {!isGuest ? (
            <button 
              onClick={() => {
                logoutUser();
                setIsLoggedIn(false);
                setIsGuest(true);
                setCurrentUserProfile(null);
                setCurrentView('HOME');
              }}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={() => {
                setIsGuest(false);
                setIsLoggedIn(false);
                setCurrentUserProfile(null);
              }}
              className="px-3 py-1.5 bg-ferry-500 text-white text-[10px] font-bold rounded-lg hover:bg-ferry-600 transition-colors shadow-sm"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {currentUserRole === UserRole.ADMIN && <AdminPanel requests={requests} onManualQuote={handleManualQuote} />}

        {currentView === 'PROFILE' ? (
          <UnifiedProfile profile={currentUserProfile} onUpdateProfile={(p) => setCurrentUserProfile(p)} onSignOut={() => { setIsLoggedIn(false); setIsGuest(true); setCurrentUserProfile(null); }} />
        ) : (
          <>
            {currentUserRole === UserRole.STORE && currentView === 'HOME' && <StorePanel requests={requests} profile={currentUserProfile} />}
            {currentUserRole === UserRole.STORE && currentView === 'CATALOG' && (
              <CatalogManager
                storeId={currentUserProfile?.uid || ''}
                storeName={currentUserProfile?.displayName || 'Mi Ferretería'}
                onClose={() => setCurrentView('HOME')}
              />
            )}
            {currentUserRole === UserRole.USER && (
              <>
                {currentView === 'HOME' && <HomeView
                  userName={currentUserProfile?.displayName || 'Usuario'}
                  ongoingRequest={ongoingRequest}
                  products={products}
                  stores={stores}
                  onNavigate={(view) => setCurrentView(view)}
                  onOpenRequest={(id) => { setActiveRequestId(id); setCurrentView('SHOP'); }}
                  userLocation={userLocation || currentUserProfile?.location || null}
                  calcularDistancia={calcularDistancia}
                  isGuest={isGuest}
                  onRegister={(role) => { setPreselectedRole(role); setIsGuest(false); setCurrentUserProfile(null); }}
                />}
                {currentView === 'SHOP' && <MaterialFlow
                  onRequestCreate={(req) => { handleRequestCreate(req); setPendingCart(null); setAutoSubmitAfterLogin(false); }}
                  activeRequest={activeRequest}
                  onAcceptQuote={handleAcceptQuote}
                  onRejectQuote={handleRejectQuote}
                  onBack={() => { setActiveRequestId(null); setCurrentView('HOME'); }}
                  onFinishOrder={handleFinishOrder}
                  stores={stores}
                  userLocation={currentUserProfile?.location}
                  isGuest={isGuest}
                  onNeedsAuth={() => setShowAuthGate(true)}
                  restoredCart={pendingCart}
                  autoSubmitAfterLogin={autoSubmitAfterLogin}
                />}
                {currentView === 'HUB' && (isGuest
                  ? <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
                      <div className="w-16 h-16 bg-ferry-100 rounded-2xl flex items-center justify-center"><Briefcase className="w-8 h-8 text-ferry-500" /></div>
                      <div><h3 className="font-bold text-slate-800">Hub de Proyectos</h3><p className="text-sm text-slate-500 mt-1">Regístrate para publicar y ver proyectos</p></div>
                      <button onClick={() => setShowAuthGate(true)} className="px-6 py-3 bg-ferry-500 text-white font-semibold rounded-2xl">Crear cuenta gratis</button>
                      <button onClick={() => { setIsGuest(false); setCurrentUserProfile(null); }} className="text-sm text-ferry-600 font-semibold hover:text-ferry-700 transition-colors">¿Ya tienes cuenta? Inicia sesión</button>
                    </div>
                  : <ProjectHub />
                )}
                {currentView === 'QUOTES' && (isGuest
                  ? <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
                      <div className="w-16 h-16 bg-ferry-100 rounded-2xl flex items-center justify-center"><Inbox className="w-8 h-8 text-ferry-500" /></div>
                      <div><h3 className="font-bold text-slate-800">Mis Cotizaciones</h3><p className="text-sm text-slate-500 mt-1">Regístrate para enviar solicitudes y recibir cotizaciones</p></div>
                      <button onClick={() => setShowAuthGate(true)} className="px-6 py-3 bg-ferry-500 text-white font-semibold rounded-2xl">Crear cuenta gratis</button>
                      <button onClick={() => { setIsGuest(false); setCurrentUserProfile(null); }} className="text-sm text-ferry-600 font-semibold hover:text-ferry-700 transition-colors">¿Ya tienes cuenta? Inicia sesión</button>
                    </div>
                  : <UserQuotesInbox />
                )}
              </>
            )}
          </>
        )}
      </main>

      {(currentUserRole === UserRole.USER || currentUserRole === UserRole.STORE) && (
        <nav className="bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center pb-safe">
          {currentUserRole === UserRole.USER ? (
            <>
              <NavItem icon={Home} label="Inicio" view="HOME" />
              <NavItem icon={ShoppingBag} label="Materiales" view="SHOP" />
              <NavItem icon={Inbox} label="Cotizaciones" view="QUOTES" />
              <NavItem icon={Briefcase} label="Proyectos" view="HUB" />
              <NavItem icon={User} label="Perfil" view="PROFILE" />
            </>
          ) : (
            <>
              <NavItem icon={Store} label="Panel" view="HOME" />
              <NavItem icon={Package} label="Catálogo" view="CATALOG" />
              <NavItem icon={User} label="Perfil" view="PROFILE" />
            </>
          )}
        </nav>
      )}
    </div>
  );
};

export default App;
