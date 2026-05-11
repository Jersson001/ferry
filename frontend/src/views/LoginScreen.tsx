/**
 * LoginScreen.tsx — src/views/LoginScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Flujo de autenticación Ferry:
 *   Paso 0 → Splash animado
 *   Paso 1 → Selección de rol (Constructor / Ferretería)
 *   Paso 2 → Formulario email + contraseña (login o registro)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  Hammer,
  Store,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ChevronRight,
} from 'lucide-react';
import ferryLogo       from '../assets/logo.svg';
import ferryLogoBlanco from '../assets/Logo Ferry3 - Blanco.png';
import {
  signInWithEmail,
  registerWithEmail,
  friendlyAuthError,
  type FerryRole,
} from '../services/authService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onLogin: (role: FerryRole) => void;
  onGuestLogin?: () => void;
  preselectedRole?: FerryRole | null;
}

// ─── Constantes de diseño ─────────────────────────────────────────────────────

const ACCENT: Record<FerryRole, { hero: string; btn: string; ring: string; text: string }> = {
  constructor: {
    hero: 'from-ferry-600 to-ferry-500',
    btn:  'bg-ferry-600 hover:bg-ferry-700 focus:ring-ferry-400',
    ring: 'focus:ring-ferry-400 border-ferry-300',
    text: 'text-ferry-600',
  },
  ferreteria: {
    hero: 'from-amber-600 to-amber-500',
    btn:  'bg-amber-600 hover:bg-amber-700 focus:ring-amber-400',
    ring: 'focus:ring-amber-400 border-amber-300',
    text: 'text-amber-600',
  },
};

// ─── Validaciones del cliente ─────────────────────────────────────────────────

const validateEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Ingresa un correo válido';

const validatePassword = (v: string, isRegister: boolean) => {
  if (!v) return 'La contraseña es requerida';
  if (isRegister) {
    if (v.length < 8)       return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(v))   return 'Debe tener al menos una mayúscula';
    if (!/[0-9]/.test(v))   return 'Debe tener al menos un número';
  }
  return null;
};

// ─── Componente indicador de pasos ────────────────────────────────────────────

const StepDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center justify-center gap-1.5 py-2">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`rounded-full transition-all duration-300 ${
          i === current
            ? 'w-5 h-1.5 bg-ferry-500'
            : i < current
            ? 'w-1.5 h-1.5 bg-ferry-300'
            : 'w-1.5 h-1.5 bg-slate-200'
        }`}
      />
    ))}
  </div>
);

// ─── Indicador de fortaleza de contraseña ─────────────────────────────────────

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const checks = [
    { ok: password.length >= 8,    label: '8+ caracteres' },
    { ok: /[A-Z]/.test(password),  label: 'Mayúscula' },
    { ok: /[0-9]/.test(password),  label: 'Número' },
  ];
  const strength = checks.filter(c => c.ok).length;
  const colors = ['bg-red-400', 'bg-yellow-400', 'bg-green-400'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < strength ? colors[strength - 1] : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {checks.map((c, i) => (
          <span
            key={i}
            className={`text-[10px] font-medium transition-colors ${
              c.ok ? 'text-green-600' : 'text-slate-400'
            }`}
          >
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const LoginScreen: React.FC<Props> = ({ onLogin, onGuestLogin, preselectedRole }) => {
  // Pasos: 0=splash, 1=rol, 2=formulario
  const [step,         setStep]         = useState<0 | 1 | 2>(0);
  const [selectedRole, setSelectedRole] = useState<FerryRole | null>(null);

  // Splash
  const [splashPhase, setSplashPhase] = useState<'idle' | 'revving' | 'fadeout'>('idle');

  // Formulario
  const [isLogin,      setIsLogin]    = useState(true);   // true=login, false=registro
  const [email,        setEmail]      = useState('');
  const [password,     setPassword]   = useState('');
  const [confirmPass,  setConfirmPass] = useState('');
  const [displayName,  setDisplayName]= useState('');
  const [showPass,     setShowPass]   = useState(false);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Errores de campo
  const [emailErr,        setEmailErr]       = useState<string | null>(null);
  const [passwordErr,     setPasswordErr]    = useState<string | null>(null);
  const [confirmPassErr,  setConfirmPassErr] = useState<string | null>(null);

  // ── Splash automático ─────────────────────────────────────────────────────
  useEffect(() => {
    if (preselectedRole) {
      setSelectedRole(preselectedRole);
      setStep(2);
      return;
    }
    const t1 = setTimeout(() => setSplashPhase('revving'),  900);
    const t2 = setTimeout(() => setSplashPhase('fadeout'),  2000);
    const t3 = setTimeout(() => setStep(1),                 2500);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accent = ACCENT[selectedRole ?? 'constructor'];

  // ── Navegación ────────────────────────────────────────────────────────────
  const selectRole = (role: FerryRole) => {
    setSelectedRole(role);
    setError(null);
    setEmailErr(null);
    setPasswordErr(null);
    setStep(2);
  };

  const goBack = useCallback(() => {
    setError(null);
    setEmailErr(null);
    setPasswordErr(null);
    if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  }, [step]);

  const toggleMode = () => {
    setIsLogin(v => !v);
    setError(null);
    setEmailErr(null);
    setPasswordErr(null);
    setConfirmPassErr(null);
    setPassword('');
    setConfirmPass('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    // Validar campos
    const eErr = validateEmail(email);
    const pErr = validatePassword(password, !isLogin);
    const cErr = !isLogin && password !== confirmPass ? 'Las contraseñas no coinciden' : null;
    
    setEmailErr(eErr);
    setPasswordErr(pErr);
    setConfirmPassErr(cErr);
    
    if (eErr || pErr || cErr) return;

    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
        onLogin(selectedRole);
      } else {
        const name = displayName.trim() || (selectedRole === 'ferreteria' ? 'Mi Ferretería' : 'Usuario');
        const apiRole = selectedRole === 'ferreteria' ? 'STORE' : 'USER';
        await registerWithEmail(email, password, apiRole, name);
        onLogin(selectedRole);
      }
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Paso 0 — Splash
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <div
        className={`h-screen bg-gradient-to-br from-ferry-600 to-ferry-500 flex flex-col items-center justify-center transition-opacity duration-500 ${
          splashPhase === 'fadeout' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div
          className={`bg-white rounded-3xl shadow-2xl p-6 transition-transform duration-700 ${
            splashPhase === 'revving' ? 'scale-110' : 'scale-100'
          }`}
        >
          <img src={ferryLogo} alt="Ferry" className="h-16 object-contain" />
        </div>
        <p className="text-white/70 text-sm mt-6 font-medium tracking-wide animate-pulse">
          Conectando ferreterías y constructores…
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Paso 1 — Selección de rol
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="h-screen flex flex-col bg-slate-50">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-ferry-600 to-ferry-500 px-6 pt-14 pb-16 text-white text-center overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/5 rounded-full" />
          <img src={ferryLogoBlanco} alt="Ferry" className="h-10 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-black leading-tight">Bienvenido a Ferry</h1>
          <p className="text-white/80 text-sm mt-1">¿Cómo vas a usar la plataforma?</p>
        </div>

        <StepDots current={0} total={2} />

        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
          {/* Rol constructor */}
          <button
            id="role-constructor"
            onClick={() => selectRole('constructor')}
            className="w-full bg-white border-2 border-slate-100 rounded-3xl p-5 flex items-center gap-4 text-left hover:border-ferry-300 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 bg-ferry-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Hammer className="w-7 h-7 text-ferry-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-base">Soy Constructor</p>
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                Busco materiales y cotizo con ferreterías cercanas
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
          </button>

          {/* Rol ferretería */}
          <button
            id="role-ferreteria"
            onClick={() => selectRole('ferreteria')}
            className="w-full bg-white border-2 border-slate-100 rounded-3xl p-5 flex items-center gap-4 text-left hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Store className="w-7 h-7 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-base">Soy Ferretería</p>
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                Recibo solicitudes y envío cotizaciones a clientes
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
          </button>

          {/* Acceso de invitado */}
          {onGuestLogin && (
            <button
              id="guest-login"
              onClick={onGuestLogin}
              className="w-full py-3 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
            >
              Explorar sin cuenta →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Paso 2 — Formulario email + contraseña
  // ═══════════════════════════════════════════════════════════════════════════
  const roleLabel = selectedRole === 'ferreteria' ? 'Ferretería' : 'Constructor';

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className={`relative bg-gradient-to-br ${accent.hero} px-6 pt-12 pb-14 text-white overflow-hidden`}>
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <button
          onClick={goBack}
          className="absolute top-4 left-4 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <img src={ferryLogoBlanco} alt="Ferry" className="h-8 object-contain mb-3" />
        <h1 className="text-xl font-black leading-tight">
          {isLogin ? 'Bienvenido de vuelta' : `Registrarme como ${roleLabel}`}
        </h1>
        <p className="text-white/75 text-sm mt-0.5">
          {isLogin ? `Accede a tu cuenta de ${roleLabel}` : 'Crea tu cuenta gratis en segundos'}
        </p>
      </div>

      <StepDots current={1} total={2} />

      {/* Formulario */}
      <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Nombre (solo registro) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {selectedRole === 'ferreteria' ? 'Nombre de la ferretería' : 'Tu nombre'}
              </label>
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={selectedRole === 'ferreteria' ? 'Ferretería El Tornillo' : 'Juan Pérez'}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ferry-300 focus:border-ferry-400 transition"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Correo electrónico
            </label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="input-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr(null); setError(null); }}
                onBlur={() => setEmailErr(validateEmail(email))}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-2xl text-sm outline-none focus:ring-2 transition ${
                  emailErr
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-ferry-300 focus:border-ferry-400'
                }`}
              />
            </div>
            {emailErr && <p className="text-xs text-red-500 mt-1 ml-1">{emailErr}</p>}
          </div>

          {/* Contraseña */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="input-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordErr(null); setError(null); }}
                onBlur={() => setPasswordErr(validatePassword(password, !isLogin))}
                placeholder={isLogin ? 'Tu contraseña' : 'Mínimo 8 caracteres'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className={`w-full pl-10 pr-12 py-3 bg-white border rounded-2xl text-sm outline-none focus:ring-2 transition ${
                  passwordErr
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-ferry-300 focus:border-ferry-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordErr && <p className="text-xs text-red-500 mt-1 ml-1">{passwordErr}</p>}
            {!isLogin && <PasswordStrength password={password} />}
          </div>

          {/* Confirmar Contraseña (solo registro) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Confirmar Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-confirm-password"
                  type={showPass ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setConfirmPassErr(null); setError(null); }}
                  placeholder="Repite tu contraseña"
                  className={`w-full pl-10 pr-4 py-3 bg-white border rounded-2xl text-sm outline-none focus:ring-2 transition ${
                    confirmPassErr
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-slate-200 focus:ring-ferry-300 focus:border-ferry-400'
                  }`}
                />
              </div>
              {confirmPassErr && <p className="text-xs text-red-500 mt-1 ml-1">{confirmPassErr}</p>}
            </div>
          )}

          {/* Error global del backend */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Botón principal */}
          <button
            id="btn-submit"
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl text-white font-bold text-base transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${accent.btn}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isLogin ? 'Iniciando sesión…' : 'Creando cuenta…'}
              </>
            ) : isLogin ? (
              '🔐 Iniciar sesión'
            ) : (
              '🚀 Crear cuenta gratis'
            )}
          </button>

          {/* Toggle login/registro */}
          <div className="text-center pt-1">
            <button
              id="btn-toggle-mode"
              type="button"
              onClick={toggleMode}
              className={`text-sm font-semibold underline underline-offset-2 ${accent.text} hover:opacity-80 transition-opacity`}
            >
              {isLogin
                ? '¿No tienes cuenta? Regístrate gratis'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </form>

        {/* Hint de requisitos para registro */}
        {!isLogin && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
              Requisitos de contraseña
            </p>
            <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
              <li>Mínimo 8 caracteres</li>
              <li>Al menos una letra mayúscula (A–Z)</li>
              <li>Al menos un número (0–9)</li>
            </ul>
          </div>
        )}

        {/* Espaciado inferior */}
        <div className="h-8" />
      </div>
    </div>
  );
};
