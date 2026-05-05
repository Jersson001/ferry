/**
 * CompleteProfileScreen.tsx  ·  src/views/CompleteProfileScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla de onboarding que se muestra UNA SOLA VEZ al usuario recién
 * registrado cuyo documento en Firestore no tiene todavía:
 *   • displayName  (todos los roles)
 *   • location.address  (solo STORE)
 *
 * Al guardar, actualiza el documento en Firestore y llama a `onComplete`
 * con el perfil actualizado, lo cual hace que App.tsx redirija al dashboard.
 */

import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile, UserRole } from '../types';
import {
  Store,
  User,
  MapPin,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Hammer,
} from 'lucide-react';
import ferryLogo from '../assets/ferry-logo.png';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Perfil parcial que ya existe en estado global */
  profile: UserProfile;
  /** Callback que recibe el perfil completado — App.tsx lo guarda y redirige */
  onComplete: (updated: UserProfile) => void;
}

// ─── Helper: determina si el perfil está incompleto ───────────────────────────

export function isProfileIncomplete(profile: UserProfile): boolean {
  const noName = !profile.displayName?.trim() ||
    profile.displayName === 'Usuario' ||
    profile.displayName === 'Mi Ferretería';

  if (profile.role === UserRole.STORE) {
    const noAddress = !profile.location?.address?.trim();
    return noName || noAddress;
  }
  return noName;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const CompleteProfileScreen: React.FC<Props> = ({ profile, onComplete }) => {
  const isStore = profile.role === UserRole.STORE;

  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  // ── Validación ──
  const nameOk    = name.trim().length >= 3;
  const addressOk = isStore ? address.trim().length >= 5 : true;
  const canSubmit = nameOk && addressOk && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');

      // ── Construir el patch de Firestore ──
      const patch: Record<string, any> = {
        displayName:     name.trim(),
        profileComplete: true,
        updatedAt:       serverTimestamp(),
      };

      if (isStore) {
        patch['location'] = {
          ...(profile.location ?? {}),          // preservar lat/lng si existen
          address: address.trim(),
        };
      }

      // ── Actualizar Firestore ──
      await updateDoc(doc(db, 'users', uid), patch);

      // ── Actualizar Firebase Auth displayName (aparece en tokens) ──
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      }

      // ── Mostrar feedback y notificar al padre ──
      const updated: UserProfile = {
        ...profile,
        displayName: name.trim(),
        ...(isStore && {
          location: { ...(profile.location ?? { lat: 0, lng: 0 }), address: address.trim() },
        }),
      };

      setDone(true);
      // Dar 900ms para que el usuario vea el check antes de avanzar
      setTimeout(() => onComplete(updated), 900);

    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ESTADO: Guardado exitoso
  // ─────────────────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 animate-in fade-in duration-300">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg
          ${isStore ? 'bg-amber-100' : 'bg-ferry-100'}`}>
          <CheckCircle2 className={`w-10 h-10 ${isStore ? 'text-amber-600' : 'text-ferry-600'}`} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">¡Todo listo, {name.split(' ')[0]}!</h2>
          <p className="text-slate-400 text-sm mt-1">Cargando tu panel...</p>
        </div>
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PANTALLA PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────
  const gradient = isStore
    ? 'from-amber-600 to-amber-500'
    : 'from-ferry-600 to-ferry-500';

  const iconBg  = isStore ? 'bg-amber-100' : 'bg-ferry-100';
  const iconClr = isStore ? 'text-amber-600' : 'text-ferry-600';
  const RoleIcon = isStore ? Store : Hammer;

  return (
    <div className="min-h-screen bg-white flex flex-col animate-in fade-in duration-500">

      {/* ── Hero banner ── */}
      <div className={`bg-gradient-to-br ${gradient} pt-safe-top px-6 pb-10 flex flex-col items-center text-center`}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 56px)' }}
      >
        <img src={ferryLogo} alt="Ferry" className="h-8 object-contain mb-5 opacity-90" />

        {/* Ícono de rol */}
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mb-4 ring-4 ring-white/20">
          <RoleIcon className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white leading-snug">
          {isStore
            ? '¡Bienvenida, Ferretería!'
            : '¡Bienvenido a Ferry!'}
        </h1>
        <p className="text-white/75 text-sm mt-2 leading-relaxed">
          {isStore
            ? 'Antes de empezar, cuéntanos sobre tu negocio'
            : 'Solo un dato más para personalizar tu experiencia'}
        </p>
      </div>

      {/* ── Separador ondulado ── */}
      <div className={`bg-gradient-to-br ${gradient} -mb-1`}>
        <svg viewBox="0 0 375 20" className="w-full fill-white" preserveAspectRatio="none">
          <path d="M0 20 Q93.75 0 187.5 10 Q281.25 20 375 0 L375 20 Z" />
        </svg>
      </div>

      {/* ── Formulario ── */}
      <div className="flex-1 px-6 py-8 max-w-sm mx-auto w-full">

        {/* Indicador de paso */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
            bg-gradient-to-br ${gradient}`}>
            1
          </div>
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full w-1/2 bg-gradient-to-r ${gradient} rounded-full`} />
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            text-slate-300 bg-slate-100">
            ✓
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Nombre ── */}
          <div className="space-y-2">
            <label
              htmlFor="profile-name"
              className="block text-xs font-bold text-slate-500 uppercase tracking-wide"
            >
              {isStore ? 'Nombre de la Ferretería' : 'Tu Nombre Completo'}
            </label>

            <div className="relative group">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200
                ${name.trim().length >= 3 ? iconClr : 'text-slate-400'}`}>
                {isStore ? <Store className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <input
                id="profile-name"
                type="text"
                placeholder={isStore ? 'Ej. Ferretería El Constructor' : 'Ej. Carlos Rodríguez'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 bg-slate-50 text-slate-800
                  font-medium outline-none transition-all duration-200
                  placeholder:text-slate-300
                  ${nameOk
                    ? isStore
                      ? 'border-amber-400 bg-amber-50/30 focus:ring-2 focus:ring-amber-100'
                      : 'border-ferry-400 bg-ferry-50/30 focus:ring-2 focus:ring-ferry-100'
                    : 'border-slate-200 focus:border-slate-400 focus:bg-white'
                  }`}
              />
              {nameOk && (
                <CheckCircle2 className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${iconClr}
                  animate-in zoom-in duration-200`} />
              )}
            </div>

            {name.length > 0 && !nameOk && (
              <p className="text-xs text-amber-600 font-medium ml-1 animate-in slide-in-from-top-1 duration-200">
                Mínimo 3 caracteres
              </p>
            )}
          </div>

          {/* ── Dirección (solo STORE) ── */}
          {isStore && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label
                htmlFor="profile-address"
                className="block text-xs font-bold text-slate-500 uppercase tracking-wide"
              >
                Dirección Exacta de la Ferretería
              </label>

              <div className="relative">
                <MapPin className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-200
                  ${addressOk && address ? 'text-amber-500' : 'text-slate-400'}`} />
                <textarea
                  id="profile-address"
                  placeholder="Ej. Cra. 15 # 93-47, Bogotá, Chapinero"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.replace(/\n/g, ''))}
                  maxLength={150}
                  rows={2}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 bg-slate-50 text-slate-800
                    font-medium outline-none transition-all duration-200 resize-none
                    placeholder:text-slate-300 leading-snug
                    ${addressOk && address
                      ? 'border-amber-400 bg-amber-50/30 focus:ring-2 focus:ring-amber-100'
                      : 'border-slate-200 focus:border-slate-400 focus:bg-white'
                    }`}
                />
              </div>

              <p className="text-xs text-slate-400 ml-1 leading-snug">
                Esta dirección ayuda a los contratistas a calcular la distancia y el tiempo de entrega.
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600 font-medium
              animate-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {/* ── Tarjeta de beneficio ── */}
          <div className={`rounded-2xl p-4 border flex items-start gap-3
            ${isStore ? 'bg-amber-50 border-amber-100' : 'bg-ferry-50 border-ferry-100'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <RoleIcon className={`w-5 h-5 ${iconClr}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">
                {isStore ? '¿Por qué necesitamos esto?' : '¿Para qué usamos tu nombre?'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {isStore
                  ? 'Los contratistas verán tu nombre y dirección para enviarte solicitudes de cotización y calcular el envío.'
                  : 'Las ferreterías lo usarán para personalizar tu cotización y confirmar el pedido.'}
              </p>
            </div>
          </div>

          {/* ── Botón CTA ── */}
          <button
            id="btn-complete-profile"
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-4 rounded-2xl font-bold text-white text-sm
              bg-gradient-to-r ${gradient} shadow-lg
              transition-all duration-200 active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Guardar y Empezar <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

        </form>

        <p className="text-center text-xs text-slate-300 mt-6">
          Podrás actualizar esto en cualquier momento desde tu perfil.
        </p>
      </div>
    </div>
  );
};
