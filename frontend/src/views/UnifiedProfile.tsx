
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Badge } from '../components/UIComponents';
import { User, MapPin, Shield, LogOut, Edit2, Camera, Briefcase, Star, CheckCircle2, Plus, ChevronRight, Building2, FileText, Save, ExternalLink, PlayCircle, TrendingUp, ChevronDown, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

import { UserProfile, UserRole, PortfolioItem } from '../types';
import { useApi } from '../hooks/useApi';
import { AddPortfolioItemModal } from '../components/AddPortfolioItemModal';
import { PortfolioLightbox } from '../components/PortfolioLightbox';
import { Crown, Sparkles } from 'lucide-react';
import { getMySubscription, UserSubscription } from '../services/subscriptionService';
import { PlansModal } from '../components/PlansModal';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { usePlacesAutocomplete, PlacePick } from '../hooks/usePlacesAutocomplete';
import { PlaceSuggestionsDropdown } from '../components/PlaceSuggestionsDropdown';

const getInitials = (name?: string) => {
  if (!name || name === 'guest') return 'U';
  const clean = name.replace(/@.*/, '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface Props {
  profile: UserProfile | null;
  onUpdateProfile: (profile: UserProfile) => void;
  onSignOut?: () => void;
}

export const UnifiedProfile: React.FC<Props> = ({ profile, onUpdateProfile, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'PROFESSIONAL' | 'ACCOUNT'>('PROFESSIONAL');
  const [isGpsActive, setIsGpsActive] = useState(() => localStorage.getItem('ferry_disponible') === 'true');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [description, setDescription] = useState(profile?.description || 'Arquitecto con 10 años de experiencia en remodelaciones residenciales. Apasionado por el diseño funcional y materiales sostenibles.');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [showStoreMap, setShowStoreMap] = useState(
    !!(profile?.location?.lat != null && profile?.location?.lng != null && !isNaN(Number(profile.location.lat)) && !isNaN(Number(profile.location.lng)))
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showBalance, setShowBalance] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [showPlansModal, setShowPlansModal] = useState(false);

  // Security Modal States
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityForm, setSecurityForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // Editing states
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editRut, setEditRut] = useState(profile?.rut || '');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef(profile);
  const addressAutocompleteRef = useRef<HTMLInputElement>(null);
  const addressPlaces = usePlacesAutocomplete();
  const [addressInput, setAddressInput] = useState(profile?.location?.address || '');
  const { updateUserProfile, saveStoreProfile: apiSaveStoreProfile, logoutUser } = useApi();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Keep profileRef current to avoid stale closures in map callbacks
  useEffect(() => { 
    profileRef.current = profile; 
    if (profile?.description) {
      setDescription(profile.description);
    }
  }, [profile]);

  useEffect(() => {
    getMySubscription()
      .then(sub => setSubscription(sub))
      .catch(() => {});
  }, []);

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);
    
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (securityForm.newPassword.length < 6) {
      setSecurityError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSecurityLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al cambiar la contraseña');
      
      setSecuritySuccess('Contraseña actualizada correctamente.');
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowSecurityModal(false), 2000);
    } catch (err: any) {
      setSecurityError(err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  // Al elegir una sugerencia de Google (Places API New) se ubica la tienda en el mapa.
  const applyStoreAddressPick = (pick: PlacePick) => {
    setAddressInput(pick.address);
    const cur = profileRef.current;
    if (!cur) return;
    onUpdateProfile({ ...cur, location: { lat: pick.lat, lng: pick.lng, address: pick.address } });
    setShowStoreMap(true);
  };

  const AVAILABLE_SPECIALTIES = ['Plomería', 'Eléctricos', 'Depósito', 'Pintura', 'Carpintería', 'Iluminación', 'Cerrajería', 'Gas', 'Estructural'];

  const handleSaveDescription = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateUserProfile({ description });
      onUpdateProfile({ ...profile, description });
      setIsEditingBio(false);
    } catch (error) {
      console.error("Error saving description:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSpecialty = async (spec: string) => {
    if (!profile) return;
    const currentSpecs = profile.specialties || [];
    const newSpecs = currentSpecs.includes(spec)
      ? currentSpecs.filter(s => s !== spec)
      : [...currentSpecs, spec];

    try {
      await updateUserProfile({ specialties: newSpecs });
      onUpdateProfile({ ...profile, specialties: newSpecs });
    } catch (error) {
      console.error("Error updating specialties:", error);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const updates: any = {
        displayName: editName,
        rut: editRut
      };
      await updateUserProfile(updates);
      onUpdateProfile({ ...profile, ...updates });
      setIsEditingBasic(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateUserProfile({ photoURL: base64String });
        onUpdateProfile({ ...profile, photoURL: base64String });
      } catch (error) {
        console.error("Error uploading logo:", error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no soportada por tu navegador.");
      return;
    }

    setIsUpdatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, address: 'Ubicación actual' };
        setAddressInput('Ubicación actual');

        if (profile) {
          const updatedProfile = { ...profile, location: newLocation };
          onUpdateProfile(updatedProfile);

          // Persist via API
          try {
            await updateUserProfile({ location: newLocation });
          } catch (error) {
            console.error("Error updating location:", error);
          }
        }
        setIsUpdatingLocation(false);
        setLocationSaved(true);
        setShowStoreMap(true);
        setTimeout(() => setLocationSaved(false), 3000);
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsUpdatingLocation(false);
        alert("No se pudo obtener tu ubicación. Por favor, activa el GPS.");
      }
    );
  };

  const handleSaveStoreProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    setProfileSaveStatus('idle');
    try {
      await apiSaveStoreProfile({
        displayName: profile.displayName || '',
        description: profile.description || '',
        specialties: profile.specialties || [],
        rut: profile.rut,
        photoURL: profile.photoURL,
        location: profile.location,
      });
      setProfileSaveStatus('success');
      setTimeout(() => setProfileSaveStatus('idle'), 3500);
    } catch (error) {
      console.error('Error saving store profile:', error);
      setProfileSaveStatus('error');
      setTimeout(() => setProfileSaveStatus('idle'), 4000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      logoutUser();
    } catch (error) {
      console.error("Error signing out:", error);
    }
    onSignOut?.();
  };

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);

  // Cargar portafolio real desde la base de datos al montar
  useEffect(() => {
    const fetchPortfolio = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      setPortfolioLoading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${API_URL}/portfolio/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const items = await res.json();
          setPortfolio(items);
        }
      } catch (e) {
        console.error('Error al cargar portafolio:', e);
      } finally {
        setPortfolioLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  if (!profile || profile.uid === 'guest') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[70vh] bg-slate-50 rounded-3xl m-4 border border-slate-200 shadow-sm">
        <div className="w-20 h-20 bg-ferry-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <User className="w-10 h-10 text-ferry-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Ingresa a tu Cuenta</h2>
        <p className="text-slate-500 text-sm mb-8 max-w-xs leading-relaxed font-medium">
          Inicia sesión o regístrate gratis para gestionar tu perfil profesional, anclar tus catálogos, subir fotos a tu portafolio y activar suscripciones premium.
        </p>
        <div className="w-full max-w-xs">
          <Button
            variant="primary"
            onClick={() => {
              if (onSignOut) onSignOut();
            }}
            className="w-full justify-center py-4 font-black shadow-lg rounded-2xl tracking-wide uppercase text-xs"
          >
            Iniciar Sesión o Registrarse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header / Hero */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-ferry-600 to-ferry-800 rounded-b-3xl -mx-4"></div>
        <div className="flex flex-col items-center -mt-16">
          <div className="relative">
            <div className="w-28 h-28 bg-white p-1 rounded-full shadow-xl overflow-hidden">
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  className="w-full h-full rounded-full bg-slate-100 object-cover"
                  alt="Avatar"
                />
              ) : (
                <div 
                  className="w-full h-full rounded-full bg-ferry-500 flex items-center justify-center text-white text-4xl font-bold shadow-inner tracking-wider"
                  style={{ fontFamily: "'Caviar Dreams', sans-serif" }}
                >
                  {getInitials(profile?.displayName || user?.email || 'U')}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 bg-ferry-500 text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-ferry-600 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              className="hidden"
              accept="image/*"
            />
          </div>

          <div className="text-center mt-3 px-4 w-full">
            {isEditingBasic ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre / Razón Social"
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-ferry-500 outline-none"
                  />
                </div>
                {profile?.role === UserRole.STORE && (
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={editRut}
                      onChange={(e) => setEditRut(e.target.value)}
                      placeholder="RUT / NIT"
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-ferry-500 outline-none"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1 h-10 text-xs"
                    onClick={handleSaveBasicInfo}
                    isLoading={isSaving}
                  >
                    <Save className="w-3 h-3" /> Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 text-xs"
                    onClick={() => setIsEditingBasic(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-800">{profile?.displayName || 'Usuario'}</h2>
                  <button onClick={() => setIsEditingBasic(true)} className="p-1 text-slate-400 hover:text-ferry-500">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                {profile?.rut && (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">RUT: {profile.rut}</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Badge type={profile?.role === UserRole.STORE ? 'success' : 'info'}>
              {profile?.role === UserRole.STORE ? 'Ferretería Aliada' : 'Cliente Premium'}
            </Badge>
            <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
              <Star className="w-4 h-4 fill-yellow-500" /> 4.9
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex p-1 bg-slate-100 rounded-xl mx-2">
        <button
          onClick={() => setActiveTab('PROFESSIONAL')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'PROFESSIONAL' ? 'bg-white text-ferry-700 shadow-sm' : 'text-slate-500'}`}
        >
          <Briefcase className="w-4 h-4" /> Profesional
        </button>
        <button
          onClick={() => setActiveTab('ACCOUNT')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'ACCOUNT' ? 'bg-white text-ferry-700 shadow-sm' : 'text-slate-500'}`}
        >
          <User className="w-4 h-4" /> Mi Cuenta
        </button>
      </div>

      {/* --- PROFESSIONAL VIEW --- */}
      {activeTab === 'PROFESSIONAL' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
          {/* Bio / Description Section */}
          <Card>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-ferry-500" />
                {profile?.role === UserRole.STORE ? 'Descripción de la Empresa' : 'Sobre mí'}
              </h3>
              <button
                onClick={() => isEditingBio ? handleSaveDescription() : setIsEditingBio(true)}
                disabled={isSaving}
                className="text-xs font-bold text-ferry-600 uppercase tracking-wider disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : (isEditingBio ? 'Guardar' : 'Editar')}
              </button>
            </div>
            {isEditingBio ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={profile?.role === UserRole.STORE ? "Cuéntanos sobre tu ferretería, especialidades y servicios..." : "Cuéntanos sobre tu experiencia profesional..."}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 h-24 resize-none outline-none focus:ring-2 focus:ring-ferry-500"
              />
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                {profile?.description || (profile?.role === UserRole.STORE ? 'Sin descripción empresarial.' : 'Sin biografía profesional.')}
              </p>
            )}
          </Card>

          {/* Specialties + Ubicación (Solo para Tiendas) */}
          {profile?.role === UserRole.STORE && (
            <div className="space-y-4">
              {/* Especialidades */}
              <div>
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-ferry-500" /> Especialidades
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SPECIALTIES.map(spec => (
                    <button
                      key={spec}
                      onClick={() => handleToggleSpecialty(spec)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${profile.specialties?.includes(spec)
                        ? 'bg-ferry-600 border-ferry-600 text-white shadow-md shadow-ferry-200'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-ferry-300'
                        }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ubicación de la tienda */}
              <div>
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-ferry-500" /> Ubicación de la Tienda
                  </h3>
                  {locationSaved && (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1 animate-in fade-in">
                      ✅ Ubicación guardada
                    </span>
                  )}
                </div>
                <button
                  onClick={handleUpdateLocation}
                  disabled={isUpdatingLocation}
                  className="w-full flex items-center gap-3 p-4 bg-ferry-50 border-2 border-ferry-200 hover:border-ferry-500 rounded-xl transition-all disabled:opacity-60 group"
                >
                  <div className="w-10 h-10 bg-ferry-100 rounded-xl flex items-center justify-center group-hover:bg-ferry-200 transition-colors flex-shrink-0">
                    <MapPin className="w-5 h-5 text-ferry-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm text-slate-800">
                      {isUpdatingLocation ? 'Obteniendo GPS...' : '📍 Fijar ubicación de la tienda'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {profile?.location?.lat != null && profile?.location?.lng != null && !isNaN(Number(profile.location.lat)) && !isNaN(Number(profile.location.lng))
                        ? `✅ ${Number(profile.location.lat).toFixed(4)}, ${Number(profile.location.lng).toFixed(4)}`
                        : 'Los usuarios te encontrarán en el mapa'}
                    </p>
                  </div>
                  {isUpdatingLocation && (
                    <div className="w-5 h-5 border-2 border-ferry-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                </button>

                {/* Address autocomplete search */}
                <div className="relative mt-3">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={addressAutocompleteRef}
                    type="text"
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      addressPlaces.search(e.target.value);
                    }}
                    onBlur={() => setTimeout(addressPlaces.clear, 200)}
                    placeholder="Busca la dirección de tu ferretería..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-ferry-500 outline-none shadow-sm"
                  />
                  <PlaceSuggestionsDropdown
                    predictions={addressPlaces.predictions}
                    onPickPrediction={async (prediction) => {
                      const pick = await addressPlaces.select(prediction);
                      if (pick) applyStoreAddressPick(pick);
                    }}
                  />
                </div>

                {/* Draggable Google Map */}
                {showStoreMap && profile?.location?.lat != null && profile?.location?.lng != null && !isNaN(Number(profile.location.lat)) && !isNaN(Number(profile.location.lng)) && (
                  <div className="mt-3 space-y-2">
                    <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <Map
                        defaultZoom={16}
                        center={{ lat: Number(profile.location.lat), lng: Number(profile.location.lng) }}
                        mapId="DEMO_MAP_ID"
                        disableDefaultUI={true}
                      >
                        <AdvancedMarker
                          position={{ lat: Number(profile.location.lat), lng: Number(profile.location.lng) }}
                          draggable={true}
                          onDragEnd={(e) => {
                            if (!e.latLng) return;
                            const newLat = e.latLng.lat();
                            const newLng = e.latLng.lng();
                            const cur = profileRef.current;
                            if (!cur) return;
                            const newLocation = { lat: newLat, lng: newLng, address: cur.location?.address || 'Ubicación actual' };
                            onUpdateProfile({ ...cur, location: newLocation });
                            updateUserProfile({ location: newLocation }).catch(err => console.error(err));
                          }}
                        />
                      </Map>
                    </div>
                    <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Arrastra el pin para ajustar la ubicación exacta de la entrada de tu ferretería
                    </p>
                  </div>
                )}
              </div>

              {/* ── Guardar Perfil de Tienda ── */}
              <div className="pt-2">
                {profileSaveStatus === 'success' && (
                  <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ¡Perfil guardado con éxito!
                  </div>
                )}
                {profileSaveStatus === 'error' && (
                  <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold animate-in fade-in">
                    Error al guardar. Verifica tu conexión e inténtalo de nuevo.
                  </div>
                )}
                <Button
                  variant="primary"
                  onClick={handleSaveStoreProfile}
                  isLoading={isSavingProfile}
                  className="w-full h-12 text-sm font-bold shadow-lg shadow-ferry-200"
                >
                  <Save className="w-4 h-4" />
                  {isSavingProfile ? 'Guardando...' : 'Guardar Perfil de Tienda'}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Guarda nombre, descripción, especialidades y ubicación
                </p>
              </div>
            </div>
          )}

          {/* Availability Toggle for Professionals */}
          {profile?.role !== UserRole.STORE && (
            <Card className="bg-white border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    Estoy disponible / En servicio
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                    Activa esta opción para aparecer en las búsquedas de clientes que necesitan profesionales en este momento.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => {
                      const next = !isGpsActive;
                      setIsGpsActive(next);
                      localStorage.setItem('ferry_disponible', String(next));
                    }}
                    className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 shrink-0 ${isGpsActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    aria-label="Cambiar disponibilidad"
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${isGpsActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  {isGpsActive && (
                    <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      En línea
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Portfolio Section */}
          {profile?.role !== UserRole.STORE && (
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="font-bold text-slate-800">Portafolio de Proyectos</h3>
                <button onClick={() => setShowAddModal(true)} className="p-1.5 bg-ferry-100 text-ferry-600 rounded-lg">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {portfolio.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLightboxItem(item)}
                    className="aspect-square rounded-xl overflow-hidden relative group bg-slate-100"
                  >
                    {item.type === 'image' && (
                      <img
                        src={item.url}
                        className="w-full h-full object-cover"
                        alt={item.description || 'Proyecto'}
                        onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Imagen'; }}
                      />
                    )}
                    {item.type === 'video' && (
                      <>
                        <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <PlayCircle className="w-8 h-8 text-white drop-shadow" />
                        </div>
                      </>
                    )}
                    {item.type === 'link' && (
                      <div className="w-full h-full bg-orange-50 flex flex-col items-center justify-center gap-1 px-2">
                        <ExternalLink className="w-6 h-6 text-ferry-500" />
                        <span className="text-[10px] text-slate-500 font-medium text-center truncate w-full">{item.url.replace(/^https?:\/\//, '')}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                  </button>
                ))}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-ferry-300 transition-all"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase">Subir</span>
                </button>
              </div>
            </div>
          )}

          {/* Add Portfolio Modal */}
          {showAddModal && (
            <AddPortfolioItemModal
              onClose={() => setShowAddModal(false)}
              onAdded={(item) => {
                setPortfolio(prev => [...prev, item]);
              }}
            />
          )}

          {/* Lightbox */}
          {lightboxItem && (
            <PortfolioLightbox
              item={lightboxItem}
              onClose={() => setLightboxItem(null)}
              onDeleted={(deleted) => {
                setPortfolio(prev => prev.filter(p => p.id !== deleted.id));
                setLightboxItem(null);
              }}
            />
          )}

          {/* Verification Status */}
          {profile?.isEmailVerified ? (
            <Card className="bg-blue-50 border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">Identidad Verificada</h4>
                  <p className="text-xs text-blue-700">Tu cuenta cumple con los estándares de seguridad.</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-amber-50 border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-white">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">Correo no verificado</h4>
                  <p className="text-xs text-amber-700">Verifica tu correo para completar tu identidad.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* --- ACCOUNT VIEW --- */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Tarjeta de Suscripción / Mi Plan */}
          <Card className="border-2 border-ferry-500/30 bg-gradient-to-br from-orange-50/50 via-white to-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-ferry-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-ferry-600 font-bold text-xs uppercase tracking-wider mb-1">
                  <Crown className="w-4 h-4" /> Suscripción Activa
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  {subscription?.plan?.name || (profile?.role === UserRole.STORE ? 'Ferretería Gratuita' : 'Contratista Gratuito')}
                </h3>
              </div>
              <Badge type={subscription?.plan?.priceInCents && subscription.plan.priceInCents > 0 ? 'success' : 'info'}>
                {subscription?.status === 'active' ? 'ACTIVO' : 'GRATUITO'}
              </Badge>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              {subscription?.plan?.priceInCents ? 'Disfrutando de los beneficios profesionales avanzados.' : 'Estás usando el plan básico gratuito de la plataforma.'}
            </p>

            {/* Barras de uso */}
            <div className="space-y-4 mb-6 pt-2 border-t border-slate-100">
              {profile?.role !== UserRole.STORE ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>📷 Portafolio de Proyectos</span>
                      <span>{portfolio.length} / {subscription?.plan?.maxPortfolioItems === -1 ? 'Ilimitadas' : (subscription?.plan?.maxPortfolioItems || 6)} fotos</span>
                    </div>
                    {subscription?.plan?.maxPortfolioItems !== -1 && (
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-ferry-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (portfolio.length / Math.max(1, subscription?.plan?.maxPortfolioItems || 6)) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>📝 Postulaciones a Proyectos</span>
                      <span>{subscription?.creditsBalance || 0} / {subscription?.plan?.maxLeadsOrApplications === -1 ? 'Ilimitadas' : (subscription?.plan?.maxLeadsOrApplications || 0)} disponibles</span>
                    </div>
                    {subscription?.plan?.maxLeadsOrApplications !== -1 && (
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, ((subscription?.creditsBalance || 0) / Math.max(1, subscription?.plan?.maxLeadsOrApplications || 1)) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>🎯 Leads Calificados</span>
                    <span>{subscription?.creditsBalance ?? 10} / {subscription?.plan?.maxLeadsOrApplications === -1 ? 'Ilimitados' : (subscription?.plan?.maxLeadsOrApplications ?? 10)} disponibles</span>
                  </div>
                  {subscription?.plan?.maxLeadsOrApplications !== -1 && (
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((subscription?.creditsBalance ?? 10) / Math.max(1, subscription?.plan?.maxLeadsOrApplications ?? 10)) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              onClick={() => setShowPlansModal(true)}
              className="w-full justify-center shadow-lg font-bold py-3"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {subscription?.plan?.priceInCents ? 'Cambiar Plan o Ver Opciones' : 'Mejorar Plan a Profesional'}
            </Button>
          </Card>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Balance de Ventas (Solo para Ferreterías) */}
            {profile?.role === UserRole.STORE && (
              <>
                <button
                  onClick={() => setShowBalance(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-slate-800">Balance de Ventas</p>
                      <p className="text-xs text-slate-500">Resumen de ingresos generados por la app</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showBalance ? 'rotate-180' : ''}`} />
                </button>

                {/* Panel de balance — acordeón */}
                {showBalance && (
                  <div className="px-4 pb-4 pt-3 bg-gradient-to-b from-green-50/60 to-white border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl border border-green-100 p-3 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hoy</p>
                        <p className="text-lg font-extrabold text-green-600">$450.000</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">COP</p>
                      </div>
                      <div className="bg-white rounded-xl border border-ferry-100 p-3 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Este mes</p>
                        <p className="text-lg font-extrabold text-ferry-600">$3.200.000</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">COP</p>
                      </div>
                    </div>
                    <div className="mt-3 bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Últimas transacciones</p>
                      {[
                        { desc: 'Cotización #1042 — Cemento y varilla', monto: '$185.000', hora: 'Hace 2h' },
                        { desc: 'Cotización #1038 — Pintura vinilo x4', monto: '$112.000', hora: 'Ayer' },
                        { desc: 'Cotización #1031 — Tubería PVC', monto: '$153.000', hora: 'Hace 3 días' },
                      ].map((t, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{t.desc}</p>
                            <p className="text-[10px] text-slate-400">{t.hora}</p>
                          </div>
                          <span className="text-xs font-bold text-green-600">{t.monto}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-[9px] text-slate-300 mt-2 uppercase tracking-widest">Datos de ejemplo — próximamente en tiempo real</p>
                  </div>
                )}
              </>
            )}

            {/* Seguridad / Cambio de Contraseña */}
            <button 
              onClick={() => setShowSecurityModal(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-slate-800">Cambiar Contraseña</p>
                  <p className="text-xs text-slate-500">Actualizar tu clave de acceso</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full text-red-500 border-red-100 hover:bg-red-50 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Cerrar Sesión
            </Button>
            <p className="text-center text-[10px] text-slate-400 mt-4 uppercase tracking-widest">Ferry App v1.0.4</p>
          </div>
        </div>
      )}

      {showPlansModal && (
        <PlansModal
          isOpen={showPlansModal}
          onClose={() => setShowPlansModal(false)}
          userRole={profile?.role || UserRole.USER}
          currentSubscription={subscription}
          onPlanUpdated={(newSub) => setSubscription(newSub)}
        />
      )}

      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowSecurityModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Seguridad</h3>
                <p className="text-xs text-slate-500">Cambiar tu contraseña</p>
              </div>
            </div>

            {securityError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{securityError}</p>
              </div>
            )}
            {securitySuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-600 text-xs font-medium rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <p>{securitySuccess}</p>
              </div>
            )}

            <form onSubmit={handleSecuritySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contraseña Actual</label>
                <input
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={e => setSecurityForm({...securityForm, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 transition-shadow"
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwd1 ? 'text' : 'password'}
                    value={securityForm.newPassword}
                    onChange={e => setSecurityForm({...securityForm, newPassword: e.target.value})}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 transition-shadow"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd1(!showPwd1)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwd2 ? 'text' : 'password'}
                    value={securityForm.confirmPassword}
                    onChange={e => setSecurityForm({...securityForm, confirmPassword: e.target.value})}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ferry-400 transition-shadow"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd2(!showPwd2)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSecurityModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={securityLoading || securitySuccess !== null} className="flex-1 bg-slate-800 hover:bg-slate-900">
                  {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
