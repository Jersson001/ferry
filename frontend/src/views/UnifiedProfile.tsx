
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Badge } from '../components/UIComponents';
import { User, MapPin, Shield, LogOut, Edit2, Camera, Briefcase, Star, CheckCircle2, Plus, ChevronRight, Building2, FileText, Save, ExternalLink, PlayCircle, TrendingUp, ChevronDown } from 'lucide-react';
import { auth } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';

import { UserProfile, UserRole, PortfolioItem } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveStoreProfile, profileToStoreData } from '../services/storeService';
import { AddPortfolioItemModal } from '../components/AddPortfolioItemModal';
import { PortfolioLightbox } from '../components/PortfolioLightbox';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const GMAPS_SCRIPT_ID = 'google-maps-script';

const ensureGoogleMapsScript = (onReady: () => void) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.google) { onReady(); return; }
  if (!document.getElementById(GMAPS_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GMAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = onReady;
    document.head.appendChild(script);
  } else {
    document.getElementById(GMAPS_SCRIPT_ID)!.addEventListener('load', onReady);
  }
};

interface Props {
  profile: UserProfile | null;
  onUpdateProfile: (profile: UserProfile) => void;
  onSignOut?: () => void;
}

export const UnifiedProfile: React.FC<Props> = ({ profile, onUpdateProfile, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'PROFESSIONAL' | 'ACCOUNT'>('PROFESSIONAL');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [description, setDescription] = useState(profile?.description || 'Arquitecto con 10 años de experiencia en remodelaciones residenciales. Apasionado por el diseño funcional y materiales sostenibles.');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [showStoreMap, setShowStoreMap] = useState(!!profile?.location);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showBalance, setShowBalance] = useState(false);

  // Editing states
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editRut, setEditRut] = useState(profile?.rut || '');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const profileRef = useRef(profile);
  const addressAutocompleteRef = useRef<HTMLInputElement>(null);
  const [addressInput, setAddressInput] = useState(profile?.location?.address || '');
  const user = auth.currentUser;

  // Keep profileRef current to avoid stale closures in map callbacks
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Initialize / update Google Maps when showStoreMap is true and we have coords
  useEffect(() => {
    if (!showStoreMap || !profile?.location) return;
    const { lat, lng } = profile.location;
    const center = { lat, lng };

    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (!mapContainerRef.current || !win.google) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new win.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        markerRef.current = new win.google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          draggable: true,
          title: 'Arrastra para ajustar ubicación',
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markerRef.current.addListener('dragend', async (e: any) => {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          const cur = profileRef.current;
          if (!cur) return;
          const newLocation = { lat: newLat, lng: newLng, address: cur.location?.address || 'Ubicación actual' };
          onUpdateProfile({ ...cur, location: newLocation });
          const currentUser = auth.currentUser;
          if (currentUser) {
            try {
              await updateDoc(doc(db, 'users', currentUser.uid), { location: newLocation });
            } catch (err) {
              console.error('Error updating location after drag:', err);
            }
          }
        });
      } else {
        mapInstanceRef.current.setCenter(center);
        markerRef.current?.setPosition(center);
      }
    };

    ensureGoogleMapsScript(initMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStoreMap, profile?.location?.lat, profile?.location?.lng]);

  // Initialize Google Places Autocomplete on the address input
  useEffect(() => {
    if (profile?.role !== UserRole.STORE) return;
    const initAutocomplete = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (!addressAutocompleteRef.current || !win.google) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ac = new win.google.maps.places.Autocomplete(addressAutocompleteRef.current, {
        componentRestrictions: { country: 'co' },
        fields: ['formatted_address', 'geometry'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        const newAddress = place.formatted_address || '';
        setAddressInput(newAddress);
        const cur = profileRef.current;
        if (!cur) return;
        const newLocation = { lat: newLat, lng: newLng, address: newAddress };
        onUpdateProfile({ ...cur, location: newLocation });
        if (mapInstanceRef.current && markerRef.current) {
          const newCenter = { lat: newLat, lng: newLng };
          mapInstanceRef.current.setCenter(newCenter);
          mapInstanceRef.current.setZoom(17);
          markerRef.current.setPosition(newCenter);
        } else {
          setShowStoreMap(true);
        }
      });
    };
    ensureGoogleMapsScript(initAutocomplete);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  const AVAILABLE_SPECIALTIES = ['Plomería', 'Eléctricos', 'Depósito', 'Pintura', 'Carpintería', 'Iluminación', 'Cerrajería', 'Gas', 'Estructural'];

  const handleSaveDescription = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { description });
      }
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
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { specialties: newSpecs });
      }
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

      if (user) {
        await updateDoc(doc(db, 'users', user.uid), updates);
        await updateProfile(user, { displayName: editName });
      }

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
    if (!file || !profile || !user) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, 'users', user.uid), { photoURL: base64String });
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

          // Persist to Firestore if logged in
          if (user) {
            try {
              await updateDoc(doc(db, 'users', user.uid), { location: newLocation });
            } catch (error) {
              console.error("Error updating location in Firestore:", error);
            }
          }
        }
        setIsUpdatingLocation(false);
        setLocationSaved(true);
        setShowStoreMap(true);
        // Reset map instance so it re-initializes centered on new coords
        mapInstanceRef.current = null;
        markerRef.current = null;
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
      await saveStoreProfile(profileToStoreData(profile));
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
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
    // Also reset local state (needed for mock auth)
    onSignOut?.();
  };

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(profile?.portfolio || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);

  return (
    <div className="space-y-6 pb-24">
      {/* Header / Hero */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-ferry-600 to-ferry-800 rounded-b-3xl -mx-4"></div>
        <div className="flex flex-col items-center -mt-16">
          <div className="relative">
            <div className="w-28 h-28 bg-white p-1 rounded-full shadow-xl overflow-hidden">
              <img
                src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'guest'}`}
                className="w-full h-full rounded-full bg-slate-100 object-cover"
                alt="Avatar"
              />
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
                      {profile?.location
                        ? `✅ ${profile.location.lat.toFixed(4)}, ${profile.location.lng.toFixed(4)}`
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
                    onChange={(e) => setAddressInput(e.target.value)}
                    placeholder="Busca la dirección de tu ferretería..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-ferry-500 outline-none shadow-sm"
                  />
                </div>

                {/* Draggable Google Map */}
                {showStoreMap && profile?.location && (
                  <div className="mt-3 space-y-2">
                    <div
                      ref={mapContainerRef}
                      className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 shadow-sm"
                    />
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
                    ¡Perfil guardado en Firebase con éxito!
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
                  {isSavingProfile ? 'Guardando en Firebase...' : 'Guardar Perfil de Tienda'}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Guarda nombre, descripción, especialidades y ubicación en Firestore
                </p>
              </div>
            </div>
          )}

          {/* Portfolio Section */}
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

          {/* Add Portfolio Modal */}
          {showAddModal && (
            <AddPortfolioItemModal
              onClose={() => setShowAddModal(false)}
              onAdded={(item) => {
                setPortfolio(prev => [...prev, item]);
                onUpdateProfile({ ...profile!, portfolio: [...portfolio, item] });
              }}
            />
          )}

          {/* Lightbox */}
          {lightboxItem && (
            <PortfolioLightbox
              item={lightboxItem}
              onClose={() => setLightboxItem(null)}
              onDeleted={(deleted) => {
                const updated = portfolio.filter(p => p.id !== deleted.id);
                setPortfolio(updated);
                onUpdateProfile({ ...profile!, portfolio: updated });
                setLightboxItem(null);
              }}
            />
          )}

          {/* Verification Status */}
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
        </div>
      )}

      {/* --- ACCOUNT VIEW --- */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Balance de Ventas */}
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

            {/* Seguridad */}
            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-slate-800">Seguridad</p>
                  <p className="text-xs text-slate-500">Contraseña, 2FA</p>
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
    </div>
  );
};
