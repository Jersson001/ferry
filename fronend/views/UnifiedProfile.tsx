
import React, { useState, useRef } from 'react';
import { Button, Card, Badge, StarRating } from '../components/UIComponents';
import { User, Camera, ShieldCheck, MapPin, Phone, Briefcase, Image as ImageIcon, Upload, Trash2, CreditCard, Bell, ChevronRight, LogOut, Settings, PenTool } from 'lucide-react';

export const UnifiedProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PROFESSIONAL' | 'ACCOUNT'>('PROFESSIONAL');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Unified User State
  const [profile, setProfile] = useState({
    name: 'Pedro Martínez',
    role: 'Plomero & Contratista',
    bio: 'Especialista en reparaciones hidráulicas residenciales. 8 años de experiencia garantizando cero fugas.',
    location: 'Bogotá, Norte',
    phone: '300 123 4567',
    stats: { 
        rating: 4.8, 
        jobs: 142, // As Contractor
        orders: 12 // As Client
    }
  });

  const [portfolio, setPortfolio] = useState<string[]>([
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200'
  ]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPortfolio([reader.result as string, ...portfolio]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-4">
      
      {/* Universal Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="h-24 bg-gradient-to-r from-ferry-600 to-slate-900"></div>
        <div className="px-6 pb-6">
          <div className="relative -mt-12 mb-4 flex justify-between items-end">
             <div className="w-24 h-24 bg-white p-1 rounded-full shadow-lg">
                <div className="w-full h-full bg-slate-200 rounded-full flex items-center justify-center overflow-hidden relative">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=c1" alt="Avatar" className="w-full h-full" />
                </div>
             </div>
             <div className="mb-2">
               <Badge type="success">Verificado</Badge>
             </div>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {profile.name} <ShieldCheck className="w-5 h-5 text-blue-500" />
            </h2>
            <p className="text-ferry-600 font-medium">{profile.role}</p>
            <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {profile.location}</span>
            </div>
          </div>

          {/* Combined Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="text-center">
               <span className="block font-bold text-xl text-slate-800">{profile.stats.rating}</span>
               <div className="flex justify-center text-[8px]"><StarRating rating={5} /></div>
            </div>
            <div className="text-center border-l border-slate-100">
               <span className="block font-bold text-xl text-slate-800">{profile.stats.jobs}</span>
               <span className="text-[10px] text-slate-400 uppercase">Trabajos</span>
            </div>
            <div className="text-center border-l border-slate-100">
               <span className="block font-bold text-xl text-slate-800">{profile.stats.orders}</span>
               <span className="text-[10px] text-slate-400 uppercase">Compras</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex p-1 bg-white border border-slate-200 rounded-xl">
        <button 
          onClick={() => setActiveTab('PROFESSIONAL')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'PROFESSIONAL' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Briefcase className="w-4 h-4" /> Mi Negocio
        </button>
        <button 
          onClick={() => setActiveTab('ACCOUNT')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'ACCOUNT' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Settings className="w-4 h-4" /> Mi Cuenta
        </button>
      </div>

      {/* --- PROFESSIONAL TAB CONTENT (Selling/Working) --- */}
      {activeTab === 'PROFESSIONAL' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
           <Card className="bg-blue-50/50 border-blue-100">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <PenTool className="w-4 h-4 text-ferry-600" /> Bio Profesional
                </h3>
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                   {isEditing ? 'Guardar' : 'Editar'}
                </button>
              </div>
              {isEditing ? (
                 <textarea 
                    className="w-full p-2 rounded border border-blue-200 text-sm" 
                    value={profile.bio}
                    onChange={(e) => setProfile({...profile, bio: e.target.value})}
                 />
              ) : (
                 <p className="text-slate-600 text-sm leading-relaxed">{profile.bio}</p>
              )}
           </Card>

           <div>
              <div className="flex justify-between items-center mb-3 px-1">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <ImageIcon className="w-4 h-4 text-ferry-600" /> Mi Portafolio
                 </h3>
                 <span className="text-xs text-slate-400">{portfolio.length} fotos</span>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="aspect-square rounded-xl border-2 border-dashed border-ferry-300 bg-ferry-50 flex flex-col items-center justify-center text-ferry-600 cursor-pointer hover:bg-ferry-100 transition-colors"
                 >
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Subir Foto</span>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                 </div>

                 {portfolio.map((img, idx) => (
                   <div key={idx} className="aspect-square rounded-xl overflow-hidden relative bg-slate-100 shadow-sm">
                     <img src={img} className="w-full h-full object-cover" alt="Portfolio" />
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- ACCOUNT TAB CONTENT (Buying/Settings) --- */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
           
           <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><MapPin className="w-5 h-5"/></div>
                   <div>
                      <span className="block font-semibold text-slate-700 text-left">Mis Direcciones</span>
                      <span className="block text-xs text-slate-400 text-left">Casa, Taller, Obras activas</span>
                   </div>
               </div>
               <ChevronRight className="w-5 h-5 text-slate-300" />
           </button>

           <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><CreditCard className="w-5 h-5"/></div>
                   <div>
                      <span className="block font-semibold text-slate-700 text-left">Métodos de Pago</span>
                      <span className="block text-xs text-slate-400 text-left">Nequi, Tarjetas guardadas</span>
                   </div>
               </div>
               <ChevronRight className="w-5 h-5 text-slate-300" />
           </button>

           <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Bell className="w-5 h-5"/></div>
                   <span className="font-semibold text-slate-700">Notificaciones</span>
               </div>
               <Badge type="warning">2 Nuevas</Badge>
           </button>

           <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 mt-6">
             <LogOut className="w-5 h-5 mr-2" /> Cerrar Sesión
           </Button>
        </div>
      )}

    </div>
  );
};
