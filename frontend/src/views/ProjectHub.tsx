
import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Card, Button } from '../components/UIComponents';
import { MapPin, DollarSign, Briefcase, Plus, User, HardHat, Search, ChevronRight, CheckCircle2, ArrowLeft, ShieldCheck, FileText, Phone, Loader2, X, AlertCircle } from 'lucide-react';
import { createProject, getMyProjects, getProjectFeed, getProjectApplications, applyToProject, acceptApplication, cancelProject, ProjectFeedItem, ProjectApplication } from '../services/projectsService';
import { generateIntegrityHash, WOMPI_PUBLIC_KEY } from '../utils/wompi';

const getInitials = (name?: string) => {
  if (!name || name === 'guest') return 'U';
  const clean = name.replace(/@.*/, '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const ProjectHub: React.FC = () => {
  const [viewMode, setViewMode] = useState<'CLIENT' | 'CONTRACTOR'>('CLIENT');
  const [clientSubView, setClientSubView] = useState<'LIST' | 'CANDIDATES' | 'PROFILE'>('LIST');
  const [selectedProject, setSelectedProject] = useState<ProjectFeedItem | null>(null);
  const [selectedApp, setSelectedApp] = useState<ProjectApplication | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Data states
  const [myProjects, setMyProjects] = useState<ProjectFeedItem[]>([]);
  const [marketProjects, setMarketProjects] = useState<ProjectFeedItem[]>([]);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Apply modal
  const [applyModal, setApplyModal] = useState<{ projectId: string; title: string } | null>(null);
  const [applyForm, setApplyForm] = useState({ proposal: '', price: '' });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Form State
  const [newProject, setNewProject] = useState<{ title: string, desc: string, budget: string, category: string, city: string, address: string, phone: string, urgent: boolean, postType: 'STANDARD'|'MULTIMEDIA'|'VIP' }>({ title: '', desc: '', budget: '', category: 'Plomería', city: '', address: '', phone: '', urgent: false, postType: 'STANDARD' });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const categoriesList = ['Plomería', 'Eléctricos', 'Depósito', 'Pintura', 'Carpintería', 'Iluminación', 'Cerrajería', 'Gas', 'Estructural'];

  // ── Load Data ──────────────────────────────────────────────────────
  const loadMyProjects = useCallback(async () => {
    try { const data = await getMyProjects(); setMyProjects(data); } catch { /* silent */ }
  }, []);

  const loadFeed = useCallback(async () => {
    try { const data = await getProjectFeed(); setMarketProjects(data); } catch { /* silent */ }
  }, []);

  useEffect(() => { loadMyProjects(); loadFeed(); }, [loadMyProjects, loadFeed]);

  // ── Post Project ───────────────────────────────────────────────────
  const handlePostProject = async () => {
    if (!newProject.title.trim() || !newProject.city.trim()) { setError('Título y Ciudad son obligatorios'); return; }
    setPosting(true); setError(null);
    
    try {
      const budgetNum = parseInt(newProject.budget.replace(/\D/g, '')) || 0;
      
      const doSubmit = async (transactionId?: string) => {
        // Upload files securely to backend using multipart/form-data
        const uploadedUrls: string[] = [];
        const token = localStorage.getItem('access_token');
        for (const file of mediaFiles) {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'}/storage/upload`, {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: formData
          });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            uploadedUrls.push(data.url);
          } else {
            throw new Error(`Fallo al subir el archivo: ${file.name}`);
          }
        }
        
        await createProject({
          title: newProject.title,
          description: newProject.desc,
          category: newProject.category,
          location: newProject.city,
          exactAddress: newProject.address || undefined,
          contactPhone: newProject.phone || undefined,
          budgetInCents: budgetNum * 100,
          isUrgent: newProject.urgent,
          postType: newProject.postType,
          mediaUrls: uploadedUrls,
          // transactionId if Wompi was used
        });
        
        setIsPosting(false);
        setNewProject({ title: '', desc: '', budget: '', category: 'Plomería', city: '', address: '', phone: '', urgent: false, postType: 'STANDARD' });
        setMediaFiles([]);
        await loadMyProjects();
      };

      if (newProject.postType === 'MULTIMEDIA' || newProject.postType === 'VIP') {
        const amount = newProject.postType === 'MULTIMEDIA' ? 990000 : 1990000;
        const reference = `PROJECT-${Date.now()}`;
        const hash = await generateIntegrityHash(reference, amount, 'COP');
        
        const checkout = new (window as any).WidgetCheckout({
          currency: 'COP',
          amountInCents: amount,
          reference: reference,
          publicKey: WOMPI_PUBLIC_KEY,
          signature: { integrity: hash }
        });
        checkout.open((res: any) => {
          if (res.transaction.status === 'APPROVED') {
            doSubmit(res.transaction.id);
          } else {
            setError('El pago fue rechazado o cancelado.');
            setPosting(false);
          }
        });
      } else {
        await doSubmit();
      }
    } catch (err: any) { 
      setError(err.message);
      setPosting(false); 
    }
  };



  // ── Apply to project ──────────────────────────────────────────────
  const handleApply = async () => {
    if (!applyModal) return;
    const priceNum = parseInt(applyForm.price.replace(/\D/g, '')) || 0;
    if (!applyForm.proposal.trim() || priceNum === 0) { setApplyError('Escribe tu propuesta y precio estimado'); return; }
    setApplyLoading(true); setApplyError(null);
    try {
      await applyToProject(applyModal.projectId, { proposal: applyForm.proposal, estimatedPriceInCents: priceNum * 100 });
      setAppliedIds(prev => new Set(prev).add(applyModal.projectId));
      setApplyModal(null); setApplyForm({ proposal: '', price: '' });
    } catch (err: any) { setApplyError(err.message); }
    finally { setApplyLoading(false); }
  };

  const handleViewCandidates = async (project: ProjectFeedItem) => {
    setSelectedProject(project);
    setClientSubView('CANDIDATES');
    setLoading(true);
    try {
      const apps = await getProjectApplications(project.id);
      setApplications(apps);
    } catch { setApplications([]); }
    finally { setLoading(false); }
  };

  const handleViewProfile = (app: ProjectApplication) => {
    setSelectedApp(app);
    setClientSubView('PROFILE');
  };

  const handleBack = () => {
    if (clientSubView === 'PROFILE') {
      setClientSubView('CANDIDATES');
      setSelectedApp(null);
    } else if (clientSubView === 'CANDIDATES') {
      setClientSubView('LIST');
      setSelectedProject(null);
      setApplications([]);
    }
  };

  const handleAccept = async (app: ProjectApplication) => {
    if (!selectedProject || !confirm(`¿Contratar a ${app.contractor.displayName}?`)) return;
    setLoading(true);
    try {
      const result = await acceptApplication(selectedProject.id, app.id);
      alert(`¡Contratado! Dirección revelada: ${result.revealedAddress || 'N/A'}\nTeléfono: ${result.revealedPhone || 'N/A'}`);
      setClientSubView('LIST');
      await loadMyProjects();
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const formatBudget = (cents?: number) => cents && cents > 0 ? `$${(cents / 100).toLocaleString('es-CO')}` : 'A convenir';
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
  };

  const filteredProjects = marketProjects.filter(p => {
    const matchCat = activeFilter === 'Todos' || p.category === activeFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  // --- RENDER CANDIDATES LIST ---
  if (clientSubView === 'CANDIDATES' && selectedProject) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4">
        <div className="flex items-center gap-2">
           <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
           </button>
           <div>
             <h2 className="text-xl font-bold text-slate-800">Postulados</h2>
             <p className="text-xs text-slate-500">{selectedProject.title}</p>
           </div>
        </div>

        {loading ? (
          <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-ferry-500 mx-auto" /></div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10 opacity-50">
            <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400">Aún no hay postulados para este proyecto.</p>
          </div>
        ) : (
        <div className="space-y-3">
          {applications.map(app => (
            <Card key={app.id} onClick={() => handleViewProfile(app)} className="cursor-pointer hover:shadow-md transition-shadow">
               <div className="flex items-start gap-3">
                  {app.contractor.photoURL ? (
                    <img src={app.contractor.photoURL} className="w-12 h-12 rounded-full object-cover" alt="" />
                  ) : (
                  <div className="w-12 h-12 bg-ferry-500 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-inner">
                    {getInitials(app.contractor.displayName)}
                  </div>
                  )}
                  <div className="flex-1">
                     <h3 className="font-bold text-slate-800 flex items-center gap-1">
                       {app.contractor.displayName}
                       {app.contractor.isProfileComplete && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                     </h3>
                     <p className="text-sm text-green-600 font-semibold">{formatBudget(app.estimatedPriceInCents)}</p>
                     <p className="text-xs text-slate-500 mt-1 line-clamp-1">{app.proposal}</p>
                     {app.contractor.specialties && app.contractor.specialties.length > 0 && (
                     <div className="flex gap-2 mt-2">
                       {app.contractor.specialties.slice(0, 2).map((skill: string) => (
                         <span key={skill} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{skill}</span>
                       ))}
                     </div>
                     )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
               </div>
            </Card>
          ))}
        </div>
        )}
      </div>
    );
  }

  // --- RENDER CONTRACTOR PROFILE ---
  if (clientSubView === 'PROFILE' && selectedApp) {
    const c = selectedApp.contractor;
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-20">
        <div className="relative">
           <button onClick={handleBack} className="absolute top-0 left-0 z-10 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-slate-700">
              <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="h-32 bg-gradient-to-r from-ferry-500 to-ferry-700 rounded-b-3xl -mx-4"></div>
           <div className="flex flex-col items-center -mt-16">
              {c.photoURL ? (
                <img src={c.photoURL} className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-white" alt="" />
              ) : (
              <div className="w-24 h-24 bg-ferry-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-white">
                {getInitials(c.displayName)}
              </div>
              )}
              <h2 className="text-2xl font-bold text-slate-800 mt-2 flex items-center gap-2">
                {c.displayName}
                {c.isProfileComplete && <ShieldCheck className="w-5 h-5 text-blue-500 fill-blue-100" />}
              </h2>
           </div>
        </div>
        <div className="space-y-6">
           <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-ferry-600" /> Propuesta</h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedApp.proposal}</p>
              <p className="text-green-600 font-bold text-lg mt-2">Cotización: {formatBudget(selectedApp.estimatedPriceInCents)}</p>
           </div>
           {c.description && (
           <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-ferry-600" /> Perfil Profesional</h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{c.description}</p>
           </div>
           )}
           {c.specialties && c.specialties.length > 0 && (
           <div className="flex flex-wrap gap-2">
               {c.specialties.map((skill: string, i: number) => (<Badge key={i} type="neutral">{skill}</Badge>))}
           </div>
           )}
        </div>
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-slate-100 z-10">
           <Button onClick={() => handleAccept(selectedApp)} className="w-full shadow-xl" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Contratar a ${c.displayName?.split(' ')[0]}`}
           </Button>
        </div>
      </div>
    );
  }

  // --- MAIN VIEW ---
  return (
    <div className="space-y-6 pb-20">
      
      {/* ROLE SWITCHER */}
      <div className="bg-white p-1 rounded-xl border border-slate-200 flex mb-4">
        <button 
          onClick={() => setViewMode('CLIENT')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === 'CLIENT' ? 'bg-ferry-100 text-ferry-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <User className="w-4 h-4" /> Busco Profesional
        </button>
        <button 
          onClick={() => setViewMode('CONTRACTOR')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === 'CONTRACTOR' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <HardHat className="w-4 h-4" /> Busco Trabajo
        </button>
      </div>

      {/* --- CLIENT VIEW --- */}
      {viewMode === 'CLIENT' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          {!isPosting ? (
            <>
              <div className="bg-ferry-50 rounded-2xl p-6 text-center border border-ferry-100 mb-6">
                <Briefcase className="w-12 h-12 text-ferry-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">¿Necesitas ayuda experta?</h3>
                <p className="text-slate-500 text-sm mb-4">Publica tu proyecto y recibe ofertas de contratistas y profesionales verificados.</p>
                <Button onClick={() => setIsPosting(true)} className="w-full shadow-lg shadow-ferry-200">
                  <Plus className="w-5 h-5" /> Publicar Solicitud
                </Button>
              </div>

              <h3 className="font-bold text-slate-800 mb-3 ml-1">Mis Proyectos Activos</h3>
              {myProjects.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">Aún no tienes proyectos publicados.</p>
              ) : (
              <div className="space-y-3">
                {myProjects.map(proj => (
                  <Card key={proj.id} className={`border-l-4 ${proj.status === 'OPEN' ? 'border-l-ferry-500' : proj.status === 'IN_PROGRESS' ? 'border-l-blue-500' : 'border-l-slate-300'}`}>
                    <div className="flex justify-between items-start mb-2 gap-2">
                       <div className="flex items-center gap-2 flex-wrap">
                         <h4 className="font-bold text-slate-800">{proj.title}</h4>
                         {proj.isUrgent && (
                           <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200 flex items-center gap-1">
                             🔥 Urgente
                           </span>
                         )}
                       </div>
                       <Badge type={proj.status === 'OPEN' ? 'info' : proj.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>
                         {proj.status === 'OPEN' ? '🟢 Abierto' : proj.status === 'IN_PROGRESS' ? '🔵 En progreso' : proj.status}
                       </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mb-1"><MapPin className="w-3 h-3" />{proj.location}</div>
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2">{proj.description}</p>
                    
                    {proj.status === 'OPEN' && (
                    <div 
                      onClick={() => handleViewCandidates(proj)}
                      className="bg-slate-50 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100 hover:border-ferry-200"
                    >
                       <span className="text-xs font-semibold text-slate-600">{(proj as any).applicationCount || 0} Postulados</span>
                       <div className="flex items-center text-ferry-600 text-xs font-bold">
                          Ver Perfiles <ChevronRight className="w-4 h-4" />
                       </div>
                    </div>
                    )}
                  </Card>
                ))}
              </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Nuevo Proyecto</h2>
                <button onClick={() => setIsPosting(false)} className="text-slate-400 text-sm">Cancelar</button>
              </div>
              
              <div className="space-y-3">
                {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{error}</p></div>}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Título *</label>
                  <input value={newProject.title} onChange={(e) => setNewProject({...newProject, title: e.target.value})} placeholder="Ej: Diseño de Interiores Sala" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                  <select value={newProject.category} onChange={(e) => setNewProject({...newProject, category: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500">
                    {categoriesList.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ciudad / Zona *</label>
                  <input value={newProject.city} onChange={(e) => setNewProject({...newProject, city: e.target.value})} placeholder="Ej: Bogotá - Chapinero" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Dirección Exacta <span className="text-slate-400 normal-case">(confidencial, solo visible al contratar)</span></label>
                  <input value={newProject.address} onChange={(e) => setNewProject({...newProject, address: e.target.value})} placeholder="Calle 45 #12-34 Apto 302" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Teléfono de contacto <span className="text-slate-400 normal-case">(confidencial)</span></label>
                  <input value={newProject.phone} onChange={(e) => setNewProject({...newProject, phone: e.target.value})} placeholder="300 123 4567" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Presupuesto Estimado</label>
                  <input value={newProject.budget} onChange={(e) => setNewProject({...newProject, budget: e.target.value})} placeholder="$100.000 o A convenir" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                  <textarea value={newProject.desc} onChange={(e) => setNewProject({...newProject, desc: e.target.value})} placeholder="Detalles del trabajo..." className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500 h-24 resize-none"></textarea>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={newProject.urgent} onChange={(e) => setNewProject({...newProject, urgent: e.target.checked})} className="rounded" />
                  <span className="text-sm font-semibold text-red-500">🔥 Marcar como URGENTE</span>
                </label>

                {/* Tiers UI */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2 mt-4">Elige el tipo de publicación</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div onClick={() => setNewProject({...newProject, postType: 'STANDARD'})} className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${newProject.postType === 'STANDARD' ? 'border-ferry-500 bg-ferry-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                       <h5 className="font-bold text-slate-800 flex items-center gap-1">📝 Estándar</h5>
                       <p className="text-xl font-black text-slate-800 my-1">Gratis</p>
                       <p className="text-xs text-slate-500">Publicación en texto, recibe postulaciones base.</p>
                    </div>
                    <div onClick={() => setNewProject({...newProject, postType: 'MULTIMEDIA'})} className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${newProject.postType === 'MULTIMEDIA' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                       <h5 className="font-bold text-slate-800 flex items-center gap-1">📸 Multimedia</h5>
                       <p className="text-xl font-black text-blue-600 my-1">$9.900</p>
                       <p className="text-xs text-slate-500">Agrega fotos de tu daño para cotizaciones exactas.</p>
                    </div>
                    <div onClick={() => setNewProject({...newProject, postType: 'VIP'})} className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${newProject.postType === 'VIP' ? 'border-yellow-500 bg-yellow-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                       <h5 className="font-bold text-slate-800 flex items-center gap-1">👑 VIP</h5>
                       <p className="text-xl font-black text-yellow-600 my-1">$19.900</p>
                       <p className="text-xs text-slate-500">Prioridad máxima. Atrae contratistas de 4.5+ estrellas.</p>
                    </div>
                  </div>
                </div>

                {(newProject.postType === 'MULTIMEDIA' || newProject.postType === 'VIP') && (
                  <div className="mt-4 border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-6 text-center">
                    {mediaError && (
                      <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{mediaError}</p>
                      </div>
                    )}
                    <input type="file" multiple accept="image/*,video/*" className="hidden" id="mediaUpload" onChange={(e) => {
                      setMediaError(null);
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        let err = '';
                        
                        setMediaFiles(prev => {
                          const allFiles = [...prev, ...newFiles];
                          let imgCount = 0;
                          let vidCount = 0;
                          const validFiles: File[] = [];

                          for (const f of allFiles) {
                            const isImage = f.type.startsWith('image/');
                            const isVideo = f.type.startsWith('video/');
                            
                            if (isImage && f.size > 15 * 1024 * 1024) {
                              err = 'Una imagen supera el límite de 15MB.'; continue;
                            }
                            if (isVideo && f.size > 50 * 1024 * 1024) {
                              err = 'El video supera el límite de 50MB.'; continue;
                            }

                            if (isImage) {
                              if (imgCount < 5) { imgCount++; validFiles.push(f); }
                              else { err = 'Límite de 5 imágenes alcanzado. Se omitieron archivos extra.'; }
                            } else if (isVideo) {
                              if (vidCount < 1) { vidCount++; validFiles.push(f); }
                              else { err = 'Límite de 1 video alcanzado. Se omitieron videos extra.'; }
                            }
                          }
                          
                          if (err) setMediaError(err);
                          return validFiles;
                        });
                      }
                    }} />
                    <label htmlFor="mediaUpload" className="cursor-pointer">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-2 text-slate-500"><Plus /></div>
                      <p className="text-sm font-bold text-slate-700">Subir fotos o video</p>
                      <p className="text-xs text-slate-400">Hasta 5 fotos y 1 video</p>
                    </label>
                    {mediaFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 justify-center mt-6">
                        {mediaFiles.map((f, i) => {
                          const isImage = f.type.startsWith('image/');
                          const previewUrl = isImage ? URL.createObjectURL(f) : '';
                          return (
                            <div key={i} className="w-20 h-20 bg-slate-100 rounded-2xl relative border border-slate-200 shadow-sm group overflow-visible">
                              {isImage ? (
                                <img src={previewUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-[10px] text-slate-500 font-bold">
                                  <FileText className="w-6 h-6 mb-1 text-slate-400" />
                                  <span className="truncate w-full text-center">{f.name}</span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={handlePostProject} className="w-full mt-4" disabled={posting}>
                  {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : (newProject.postType === 'STANDARD' ? 'Publicar Gratis' : `Pagar ${newProject.postType === 'MULTIMEDIA' ? '$9.900' : '$19.900'} y Publicar`)}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- CONTRACTOR VIEW --- */}
      {viewMode === 'CONTRACTOR' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
           <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Muro de Oportunidades</h2>
            <div className="bg-slate-100 p-2 rounded-full">
              <Search className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
            {['Todos', ...categoriesList].map((cat) => (
              <button 
                key={cat} 
                onClick={() => setActiveFilter(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === cat ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                    <HardHat className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-400">No hay proyectos de {activeFilter} por ahora.</p>
                </div>
            ) : (
                filteredProjects.map(project => {
                const isApplied = appliedIds.has(project.id);
                return (
                    <Card key={project.id} className={`relative transition-all hover:shadow-md ${project.postType === 'VIP' ? 'border-2 border-yellow-400 shadow-yellow-100 bg-yellow-50/20' : ''}`}>
                    {project.isUrgent && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-sm animate-pulse z-10">
                        🔥 URGENTE
                        </div>
                    )}
                    {project.postType === 'VIP' && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[10px] px-3 py-0.5 rounded-b-lg font-black shadow-sm uppercase tracking-wider">
                        👑 Proyecto VIP
                        </div>
                    )}
                    
                    <div className={`flex justify-between items-start mb-2 ${project.postType === 'VIP' ? 'mt-3' : ''}`}>
                        <Badge type={['Arquitectura', 'Diseño', 'Ingeniería'].includes(project.category) ? 'warning' : 'info'}>{project.category}</Badge>
                        <span className="text-xs text-slate-400">{timeAgo(project.createdAt)}</span>
                    </div>

                    <h3 className="font-bold text-lg mb-1 text-slate-800">{project.title}</h3>
                    <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                        <MapPin className="w-3 h-3" />
                        {project.location}
                    </div>

                    <p className="text-slate-600 text-sm line-clamp-2 mb-4 bg-slate-50 p-2 rounded-lg">
                        {project.description}
                    </p>

                    {project.mediaUrls && project.mediaUrls.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                        {project.mediaUrls.map((url, idx) => (
                          <img key={idx} src={url} className="w-16 h-16 object-cover rounded-lg shadow-sm border border-slate-200" alt="Evidencia" />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        {formatBudget(project.budgetInCents)}
                        </div>
                        <Button 
                        onClick={() => !isApplied && setApplyModal({ projectId: project.id, title: project.title })}
                        variant={isApplied ? "secondary" : "outline"} 
                        className={`!py-1 !px-4 !text-sm !rounded-lg transition-all ${isApplied ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-default' : ''}`}
                        >
                        {isApplied ? (
                            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Postulado</span>
                        ) : (
                            'Postularme'
                        )}
                        </Button>
                    </div>
                    </Card>
                );
                })
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: POSTULARME ─────────────────────────────────────────── */}
      {applyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">Tu Propuesta</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{applyModal.title}</p>
              </div>
              <button onClick={() => { setApplyModal(null); setApplyForm({ proposal: '', price: '' }); setApplyError(null); }} className="p-2 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {applyError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{applyError}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Precio Estimado (COP) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={applyForm.price}
                  onChange={(e) => setApplyForm({ ...applyForm, price: e.target.value })}
                  placeholder="Ej: 250000"
                  className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tu Propuesta *</label>
                <textarea
                  value={applyForm.proposal}
                  onChange={(e) => setApplyForm({ ...applyForm, proposal: e.target.value })}
                  placeholder="Describe brevemente tu experiencia y por qué eres el indicado..."
                  className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500 h-28 resize-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Se descontará 1 crédito de tu cuenta al postularte.
              </p>
              <Button onClick={handleApply} className="w-full mt-2" disabled={applyLoading}>
                {applyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Postulación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
