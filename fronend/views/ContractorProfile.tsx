
import React, { useState, useRef } from 'react';
import { Button, Card, Badge, StarRating } from '../components/UIComponents';
import { User, Camera, Plus, Trash2, ShieldCheck, MapPin, Phone, Briefcase, Image as ImageIcon, Upload } from 'lucide-react';

export const ContractorProfile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mock Data State
  const [profile, setProfile] = useState({
    name: 'Pedro Martínez',
    role: 'Plomero Certificado',
    bio: 'Especialista en reparaciones hidráulicas residenciales. 8 años de experiencia garantizando cero fugas.',
    location: 'Bogotá, Norte',
    phone: '300 123 4567',
    stats: { jobs: 142, rating: 4.8, exp: 8 }
  });

  const [portfolio, setPortfolio] = useState<string[]>([
    'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200'
  ]);

  const [references, setReferences] = useState([
    { id: 1, name: 'Ing. Carlos Ruiz', role: 'Jefe de Obra', phone: '310 555 1234', comment: 'Excelente cumplimiento.' },
    { id: 2, name: 'Constructora Bolivar', role: 'Cliente Corporativo', phone: '601 222 3344', comment: 'Proveedor verificado.' }
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

  const removeImage = (index: number) => {
    setPortfolio(portfolio.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-4">
      
      {/* Header & Edit Mode Toggle */}
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-slate-800">Mi Perfil Profesional</h2>
        <Button variant={isEditing ? 'primary' : 'outline'} onClick={() => setIsEditing(!isEditing)} className="!py-1 !px-3 text-sm">
          {isEditing ? 'Guardar Cambios' : 'Editar Perfil'}
        </Button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="h-24 bg-gradient-to-r from-slate-700 to-slate-900"></div>
        <div className="px-6 pb-6">
          <div className="relative -mt-12 mb-4 flex justify-between items-end">
             <div className="w-24 h-24 bg-white p-1 rounded-full shadow-lg">
                <div className="w-full h-full bg-slate-200 rounded-full flex items-center justify-center overflow-hidden relative group">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=c1" alt="Avatar" className="w-full h-full" />
                   {isEditing && (
                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer">
                        <Camera className="w-6 h-6 text-white" />
                     </div>
                   )}
                </div>
             </div>
             <div className="mb-2">
               <Badge type="success">Verificado</Badge>
             </div>
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <input 
                value={profile.name} 
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                className="w-full font-bold text-xl border-b border-slate-300 focus:border-ferry-500 outline-none"
              />
              <input 
                value={profile.role} 
                onChange={(e) => setProfile({...profile, role: e.target.value})}
                className="w-full text-ferry-600 font-medium border-b border-slate-300 focus:border-ferry-500 outline-none"
              />
              <textarea 
                value={profile.bio}
                onChange={(e) => setProfile({...profile, bio: e.target.value})}
                className="w-full text-sm text-slate-600 border rounded p-2 mt-2"
                rows={3}
              />
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {profile.name} <ShieldCheck className="w-5 h-5 text-blue-500" />
              </h3>
              <p className="text-ferry-600 font-medium">{profile.role}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-2 mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {profile.location}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {profile.phone}</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Stats Grid */}
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
               <span className="block font-bold text-xl text-slate-800">{profile.stats.exp}</span>
               <span className="text-[10px] text-slate-400 uppercase">Años Exp.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             <ImageIcon className="w-4 h-4 text-ferry-600" /> Mi Portafolio
           </h3>
           <span className="text-xs text-slate-400">{portfolio.length} fotos</span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
           {/* Add Photo Button */}
           <div 
             onClick={() => fileInputRef.current?.click()}
             className="aspect-square rounded-xl border-2 border-dashed border-ferry-300 bg-ferry-50 flex flex-col items-center justify-center text-ferry-600 cursor-pointer hover:bg-ferry-100 transition-colors"
           >
              <Upload className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold">Subir Foto</span>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
           </div>

           {/* Images */}
           {portfolio.map((img, idx) => (
             <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group bg-slate-100 shadow-sm">
               <img src={img} className="w-full h-full object-cover" alt="Portfolio" />
               {isEditing && (
                 <button 
                   onClick={() => removeImage(idx)}
                   className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md opacity-90 hover:opacity-100"
                 >
                   <Trash2 className="w-3 h-3" />
                 </button>
               )}
             </div>
           ))}
        </div>
      </div>

      {/* References / Recommended Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             <Briefcase className="w-4 h-4 text-ferry-600" /> Referencias & Recomendados
           </h3>
           <Button variant="ghost" className="!p-1 h-auto text-ferry-600">
             <Plus className="w-4 h-4" /> Agregar
           </Button>
        </div>

        <div className="space-y-3">
          {references.map(ref => (
            <Card key={ref.id} className="flex items-start gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                 {ref.name.charAt(0)}
               </div>
               <div>
                 <h4 className="font-bold text-sm text-slate-800">{ref.name}</h4>
                 <p className="text-xs text-ferry-600 font-medium">{ref.role}</p>
                 <p className="text-xs text-slate-500 mt-1 italic">"{ref.comment}"</p>
               </div>
               {isEditing && (
                 <button className="ml-auto text-slate-300 hover:text-red-400">
                   <Trash2 className="w-4 h-4" />
                 </button>
               )}
            </Card>
          ))}
          
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
             <ShieldCheck className="w-8 h-8 text-blue-500" />
             <div>
                <h4 className="font-bold text-sm text-blue-800">Certificación Ferry</h4>
                <p className="text-xs text-blue-600">Identidad y Antecedentes verificados.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
