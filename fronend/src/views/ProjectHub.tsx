
import React, { useState } from 'react';
import { Project, ContractorProfile } from '../types';
import { Badge, Card, Button, StarRating } from '../components/UIComponents';
import { MapPin, DollarSign, Briefcase, Plus, User, HardHat, Search, ChevronRight, CheckCircle2, ArrowLeft, ShieldCheck, Image as ImageIcon, MessageSquare, FileText, Phone } from 'lucide-react';

// --- MOCK DATA FOR CONTRACTORS ---
const MOCK_CONTRACTORS: ContractorProfile[] = [
  {
    id: 'c1',
    name: 'Pedro Martínez',
    role: 'Plomero Certificado',
    isVerified: true,
    rating: 4.8,
    completedJobs: 142,
    yearsExperience: 8,
    bio: 'Especialista en reparaciones hidráulicas residenciales y mantenimiento de calentadores. Trabajo garantizado y limpieza en la obra.',
    skills: ['Fugas', 'Calentadores', 'Instalación de Baños', 'PVC', 'Redes de Gas'],
    portfolioImages: [
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200'
    ],
    reviews: [
      { id: 'r1', author: 'Luisa F.', rating: 5, comment: 'Excelente trabajo, llegó puntual y dejó todo limpio.', date: 'Hace 2 días' },
      { id: 'r2', author: 'Carlos A.', rating: 4, comment: 'Muy buen profesional, aunque el precio fue un poco alto.', date: 'Hace 1 semana' }
    ],
    references: [
      { id: 'ref1', name: 'Ing. Felipe Torres', role: 'Jefe de Obra', phone: '300 123 4567', comment: 'Pedro trabajó conmigo 2 años, muy responsable.' },
      { id: 'ref2', name: 'Conjunto Residencial Los Pinos', role: 'Administración', phone: '601 555 9999', comment: 'Proveedor de confianza para emergencias.' }
    ]
  },
  {
    id: 'c2',
    name: 'Juan López',
    role: 'Maestro de Obra',
    isVerified: true,
    rating: 4.5,
    completedJobs: 89,
    yearsExperience: 12,
    bio: 'Maestro contratista con experiencia en remodelación de interiores, estuco, pintura y enchapes. Calidad y cumplimiento.',
    skills: ['Obra Blanca', 'Enchapes', 'Pintura', 'Drywall', 'Pañete'],
    portfolioImages: [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1620626012053-93f2685ce3ee?auto=format&fit=crop&q=80&w=200'
    ],
    reviews: [
      { id: 'r3', author: 'Mario B.', rating: 5, comment: 'Transformó mi cocina totalmente. Recomendado.', date: 'Hace 3 semanas' }
    ],
    references: [
       { id: 'ref3', name: 'Arq. Maria Jose', role: 'Diseñadora', phone: '315 888 7777', comment: 'Excelentes acabados en pintura.' }
    ]
  }
];

export const ProjectHub: React.FC = () => {
  const [viewMode, setViewMode] = useState<'CLIENT' | 'CONTRACTOR'>('CLIENT');
  
  // CLIENT NAVIGATION STATE
  const [clientSubView, setClientSubView] = useState<'LIST' | 'CANDIDATES' | 'PROFILE'>('LIST');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<ContractorProfile | null>(null);
  
  const [isPosting, setIsPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Todos');

  // --- STATE FOR CLIENT (MY PROJECTS) ---
  const [myProjects, setMyProjects] = useState<Project[]>([
    {
      id: '101',
      title: 'Reparación de Techo',
      location: 'Mi Casa - Norte',
      description: 'Tengo una gotera en la teja master del patio.',
      budget: '$200.000',
      isUrgent: true,
      category: 'Depósito',
      postedBy: 'Yo',
      status: 'OPEN'
    }
  ]);

  // --- STATE FOR CONTRACTOR (MARKETPLACE) ---
  const [marketProjects, setMarketProjects] = useState<Project[]>([
    {
      id: '1',
      title: 'Instalación Sanitario y Lavamanos',
      location: 'Cedritos, Bogotá',
      description: 'Necesito plomero certificado para instalar un combo de baño Corona. Todo está en sitio.',
      budget: '$120.000',
      isUrgent: true,
      category: 'Plomería',
      postedBy: 'Ana M.',
      status: 'OPEN'
    },
    {
      id: '2',
      title: 'Diseño Interior Apartamento',
      location: 'Chicó, Bogotá',
      description: 'Busco diseñador para remodelación completa de zona social e iluminación.',
      budget: '$2.500.000',
      isUrgent: false,
      category: 'Eléctricos',
      postedBy: 'Carlos R.',
      status: 'OPEN'
    },
    {
      id: '3',
      title: 'Cálculo Estructural Viga',
      location: 'Fontibón',
      description: 'Necesito ingeniero civil para validar refuerzo de una viga de amarre.',
      budget: 'A convenir',
      isUrgent: true,
      category: 'Estructural',
      postedBy: 'Constructora ACME',
      status: 'OPEN'
    },
    {
      id: '4',
      title: 'Closet Empotrado',
      location: 'Salitre',
      description: 'Fabricación e instalación de closet en madecor RH.',
      budget: '$1.800.000',
      isUrgent: false,
      category: 'Carpintería',
      postedBy: 'Laura S.',
      status: 'OPEN'
    },
    {
      id: '5',
      title: 'Planos Casa Campestre',
      location: 'La Calera',
      description: 'Arquitecto para diseño de casa de 150m2. Solo planos arquitectónicos.',
      budget: '$4.000.000',
      isUrgent: false,
      category: 'Depósito',
      postedBy: 'Familia Perez',
      status: 'OPEN'
    }
  ]);

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Form State
  const [newProject, setNewProject] = useState({ title: '', desc: '', budget: '', category: 'Plomería' });

  const categoriesList = [
    'Plomería', 'Eléctricos', 'Depósito', 'Pintura',
    'Carpintería', 'Iluminación', 'Cerrajería', 'Gas', 'Estructural'
  ];

  const handlePostProject = () => {
    const p: Project = {
      id: Date.now().toString(),
      title: newProject.title || 'Nueva Solicitud',
      description: newProject.desc,
      budget: newProject.budget || 'A convenir',
      category: newProject.category as any,
      location: 'Ubicación actual',
      isUrgent: false,
      postedBy: 'Yo',
      status: 'OPEN'
    };
    setMyProjects([p, ...myProjects]);
    setIsPosting(false);
    setNewProject({ title: '', desc: '', budget: '', category: 'Plomería' });
  }; // categorías: Plomería | Eléctricos | Depósito | Pintura | Carpintería | Iluminación | Cerrajería | Gas | Estructural

  const toggleApply = (id: string) => {
    const newSet = new Set(appliedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setAppliedIds(newSet);
  };

  const handleViewCandidates = (project: Project) => {
    setSelectedProject(project);
    setClientSubView('CANDIDATES');
  };

  const handleViewProfile = (contractor: ContractorProfile) => {
    setSelectedContractor(contractor);
    setClientSubView('PROFILE');
  };

  const handleBack = () => {
    if (clientSubView === 'PROFILE') {
      setClientSubView('CANDIDATES');
      setSelectedContractor(null);
    } else if (clientSubView === 'CANDIDATES') {
      setClientSubView('LIST');
      setSelectedProject(null);
    }
  };

  const filteredProjects = marketProjects.filter(p => 
    activeFilter === 'Todos' ? true : p.category === activeFilter
  );

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

        <div className="space-y-3">
          {MOCK_CONTRACTORS.map(contractor => (
            <Card key={contractor.id} onClick={() => handleViewProfile(contractor)} className="cursor-pointer hover:shadow-md transition-shadow">
               <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 text-lg overflow-hidden">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${contractor.id}`} alt={contractor.name} />
                  </div>
                  <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 flex items-center gap-1">
                          {contractor.name}
                          {contractor.isVerified && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                        </h3>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded text-yellow-700 font-bold text-xs">
                           <span className="text-xs">★</span> {contractor.rating}
                        </div>
                     </div>
                     <p className="text-sm text-slate-500">{contractor.role}</p>
                     <div className="flex gap-2 mt-2">
                       {contractor.skills.slice(0, 2).map(skill => (
                         <span key={skill} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{skill}</span>
                       ))}
                       {contractor.skills.length > 2 && <span className="text-[10px] text-slate-400 py-1">+2</span>}
                     </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
               </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- RENDER CONTRACTOR PROFILE ---
  if (clientSubView === 'PROFILE' && selectedContractor) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-20">
        <div className="relative">
           <button onClick={handleBack} className="absolute top-0 left-0 z-10 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-slate-700">
              <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="h-32 bg-gradient-to-r from-ferry-500 to-ferry-700 rounded-b-3xl -mx-4"></div>
           <div className="flex flex-col items-center -mt-16">
              <div className="w-24 h-24 bg-white p-1 rounded-full shadow-lg">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedContractor.id}`} className="w-full h-full rounded-full bg-slate-100" alt="Profile" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mt-2 flex items-center gap-2">
                {selectedContractor.name}
                {selectedContractor.isVerified && <ShieldCheck className="w-5 h-5 text-blue-500 fill-blue-100" />}
              </h2>
              <p className="text-slate-500 font-medium">{selectedContractor.role}</p>
              
              <div className="flex gap-6 mt-4 w-full justify-center border-b border-slate-100 pb-4">
                 <div className="text-center">
                    <span className="block font-bold text-lg">{selectedContractor.rating}</span>
                    <span className="text-xs text-slate-400 uppercase">Estrellas</span>
                 </div>
                 <div className="text-center border-l border-slate-200 pl-6">
                    <span className="block font-bold text-lg">{selectedContractor.completedJobs}</span>
                    <span className="text-xs text-slate-400 uppercase">Trabajos</span>
                 </div>
                 <div className="text-center border-l border-slate-200 pl-6">
                    <span className="block font-bold text-lg">{selectedContractor.yearsExperience} Años</span>
                    <span className="text-xs text-slate-400 uppercase">Experiencia</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           {/* CURRÍCULO / BIO */}
           <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                 <FileText className="w-4 h-4 text-ferry-600" /> Perfil Profesional
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-3 bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedContractor.bio}</p>
              
              <div className="flex flex-wrap gap-2">
                  {selectedContractor.skills.map((skill, i) => (
                    <Badge key={i} type="neutral">{skill}</Badge>
                  ))}
              </div>
           </div>

           {/* PORTFOLIO IMAGES */}
           <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-ferry-600" /> Trabajos Recomendados
              </h3>
              <div className="grid grid-cols-3 gap-2">
                 {selectedContractor.portfolioImages.map((img, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 shadow-sm border border-slate-100">
                       <img src={img} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" alt="Work" />
                    </div>
                 ))}
              </div>
           </div>

           {/* REFERENCES & RECOMMENDATIONS */}
           {selectedContractor.references && selectedContractor.references.length > 0 && (
             <div>
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-ferry-600" /> Referencias
                </h3>
                <div className="space-y-3">
                   {selectedContractor.references.map((ref, idx) => (
                      <Card key={idx} className="flex flex-col gap-1 !p-3 bg-blue-50/50 border-blue-100">
                         <div className="flex justify-between">
                            <h4 className="font-bold text-sm text-slate-800">{ref.name}</h4>
                            <span className="text-xs text-slate-400 font-mono">Ref. {idx + 1}</span>
                         </div>
                         <p className="text-xs text-ferry-600 font-medium">{ref.role}</p>
                         <p className="text-xs text-slate-500 italic">"{ref.comment}"</p>
                      </Card>
                   ))}
                </div>
             </div>
           )}

           {/* REVIEWS */}
           <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-ferry-600" /> Calificaciones ({selectedContractor.reviews.length})
              </h3>
              <div className="space-y-3">
                 {selectedContractor.reviews.map(review => (
                    <div key={review.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-slate-700">{review.author}</span>
                          <span className="text-xs text-slate-400">{review.date}</span>
                       </div>
                       <div className="flex text-yellow-400 text-xs mb-1">
                          <StarRating rating={review.rating} />
                       </div>
                       <p className="text-sm text-slate-600 italic">"{review.comment}"</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-slate-100 z-10">
           <Button className="w-full shadow-xl">
              Contratar a {selectedContractor.name.split(' ')[0]}
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
              <div className="space-y-3">
                {myProjects.map(proj => (
                  <Card key={proj.id} className="border-l-4 border-l-ferry-500">
                    <div className="flex justify-between items-start mb-2">
                       <h4 className="font-bold text-slate-800">{proj.title}</h4>
                       <Badge type="info">{proj.category}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{proj.description}</p>
                    
                    {/* Simulated Candidates Area - CLICKABLE */}
                    <div 
                      onClick={() => handleViewCandidates(proj)}
                      className="bg-slate-50 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100 hover:border-ferry-200"
                    >
                       <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center overflow-hidden">
                               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=c1" alt="avatar" />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center overflow-hidden">
                               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=c2" alt="avatar" />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-slate-600 ml-1">2 Postulados</span>
                       </div>
                       <div className="flex items-center text-ferry-600 text-xs font-bold">
                          Ver Perfiles <ChevronRight className="w-4 h-4" />
                       </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Nuevo Proyecto</h2>
                <button onClick={() => setIsPosting(false)} className="text-slate-400 text-sm">Cancelar</button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                  <input 
                    value={newProject.title}
                    onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                    placeholder="Ej: Diseño de Interiores Sala" 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                  <select 
                    value={newProject.category}
                    onChange={(e) => setNewProject({...newProject, category: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500"
                  >
                    {categoriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Presupuesto Estimado</label>
                  <input 
                    value={newProject.budget}
                    onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                    placeholder="$100.000 o A convenir" 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                  <textarea 
                    value={newProject.desc}
                    onChange={(e) => setNewProject({...newProject, desc: e.target.value})}
                    placeholder="Detalles del trabajo..." 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ferry-500 h-24 resize-none" 
                  ></textarea>
                </div>
                <Button onClick={handlePostProject} className="w-full mt-4">Publicar Ahora</Button>
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
                    <Card key={project.id} className="relative transition-all hover:shadow-md">
                    {project.isUrgent && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-sm animate-pulse z-10">
                        🔥 URGENTE
                        </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-2">
                        <Badge type={['Arquitectura', 'Diseño', 'Ingeniería'].includes(project.category) ? 'warning' : 'info'}>{project.category}</Badge>
                        <span className="text-xs text-slate-400">Hace 2h</span>
                    </div>

                    <h3 className="font-bold text-lg mb-1 text-slate-800">{project.title}</h3>
                    <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                        <MapPin className="w-3 h-3" />
                        {project.location}
                    </div>

                    <p className="text-slate-600 text-sm line-clamp-2 mb-4 bg-slate-50 p-2 rounded-lg">
                        {project.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        {project.budget}
                        </div>
                        <Button 
                        onClick={() => toggleApply(project.id)}
                        variant={isApplied ? "secondary" : "outline"} 
                        className={`!py-1 !px-4 !text-sm !rounded-lg transition-all ${isApplied ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}`}
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
    </div>
  );
};
