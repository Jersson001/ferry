/**
 * LoginScreen.tsx  ·  src/views/LoginScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla de autenticación de Ferry.
 *
 * Flujo de pasos:
 *   0 → Splash animado
 *   1 → Selección de rol (Contratista / Ferretería)
 *   2 → Selección de método (Google / Celular OTP)
 *   3 → Formulario de autenticación (Phone input → OTP)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Loader2,
  CheckCircle2,
  Hammer,
  Store,
  ShieldAlert,
  X,
  ChevronRight,
} from 'lucide-react';
import ferryLogo     from '../assets/logo.svg';
import ferryLogoBlanco from '../assets/Logo Ferry3 - Blanco.png';
import {
  signInWithEmail,
  registerWithEmail,
  friendlyAuthError,
  RbacError,
  type FerryRole,
} from '../services/authService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onLogin: (role: FerryRole) => void;
  onGuestLogin?: () => void;
  /** Rol pre-seleccionado desde un CTA externo (ej. HomeView) */
  preselectedRole?: FerryRole | null;
}

// ─── Constantes de diseño ─────────────────────────────────────────────────────

const ACCENT_BY_ROLE: Record<FerryRole, { ring: string; text: string; bg: string; hero: string; border: string }> = {
  constructor: {
    ring:   'ring-ferry-200',
    text:   'text-ferry-600',
    bg:     'bg-ferry-50',
    hero:   'from-ferry-600 to-ferry-500',
    border: 'border-ferry-400',
  },
  ferreteria: {
    ring:   'ring-amber-200',
    text:   'text-amber-600',
    bg:     'bg-amber-50',
    hero:   'from-amber-600 to-amber-500',
    border: 'border-amber-400',
  },
};

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const GoogleLogo: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/** Indicador de paso activo en la parte superior */
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

/**
 * Input de 6 celdas para el código OTP.
 * Estado interno: array de 6 strings de un dígito c/u.
 * El valor expuesto al padre es siempre una cadena de dígitos puros (sin espacios).
 */
const OtpInput: React.FC<{
  value: string;           // cadena de 0-6 dígitos (sin espacios)
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Normaliza el value externo a un array de exactamente 6 slots
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const handleChange = (idx: number, raw: string) => {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1); // solo el último dígito
    const next = digits.slice(); // copia del array
    next[idx] = digit;
    onChange(next.join('')); // exporta string puro sin espacios
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0) {
        const next = digits.slice();
        next[idx - 1] = '';
        onChange(next.join(''));
        inputs.current[idx - 1]?.focus();
      } else if (digits[idx]) {
        const next = digits.slice();
        next[idx] = '';
        onChange(next.join(''));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all duration-150
            ${d
              ? 'border-ferry-500 bg-ferry-50 text-ferry-700'
              : 'border-slate-200 bg-slate-50 text-slate-800'}
            focus:border-ferry-500 focus:ring-2 focus:ring-ferry-200 focus:bg-white
            disabled:opacity-50`}
        />
      ))}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const LoginScreen: React.FC<Props> = ({ onLogin, onGuestLogin, preselectedRole }) => {
  // ── Pasos ──
  const [step,         setStep]         = useState<0 | 1 | 2 | 3>(0);
  const [selectedRole, setSelectedRole] = useState<FerryRole | null>(null);

  // ── Estado del splash ──
  const [splashPhase, setSplashPhase]   = useState<'idle' | 'revving' | 'fadeout'>('idle');

  // ── Estado Google ──
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Estado Phone OTP ──
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [otpSent,  setOtpSent]  = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // ── Errores ──
  const [error,     setError]     = useState<string | null>(null);
  const [rbacError, setRbacError] = useState(false);

  // ── Refs para auth OTP ──
  const recaptchaRef    = useRef<any>(null);
  const confirmationRef = useRef<any>(null);

  // ── Destruir el RecaptchaVerifier al desmontar LoginScreen ──
  // Evita widgets zombie en el DOM si el usuario navega atrás o cambia de rol.
  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear(); } catch (_) {}
      recaptchaRef.current = null;
      confirmationRef.current = null;
    };
  }, []);

  // ── Splash automático ──

  useEffect(() => {
    if (preselectedRole) {
      setSelectedRole(preselectedRole);
      setStep(2);
      return;
    }
    const t1 = setTimeout(() => setSplashPhase('revving'),  1000);
    const t2 = setTimeout(() => setSplashPhase('fadeout'),  2200);
    const t3 = setTimeout(() => setStep(1),                 2700);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accent = ACCENT_BY_ROLE[selectedRole ?? 'constructor'];

  // ── Handlers ──
  const selectRole = (role: FerryRole) => {
    setSelectedRole(role);
    setError(null);
    setRbacError(false);
    setStep(2);
  };

  const goBack = useCallback(() => {
    setError(null);
    setRbacError(false);
    if (step === 3) { setOtpSent(false); setOtp(''); setStep(2); }
    else if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  }, [step]);

  // Auth con Google — simplificado a email temporal (Google OAuth requiere backend)
  const handleGoogle = async () => {
    if (!selectedRole) return;
    setGoogleLoading(true);
    setError(null);
    setRbacError(false);
    try {
      // TODO: implementar OAuth con el backend
      setError('Google Sign-In estará disponible próximamente. Usa el acceso por celular.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Enviar OTP — envia el código via el backend
  const handleSendOtp = async () => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) { setError('Ingresa un número de 10 dígitos'); return; }
    setOtpLoading(true);
    setError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+57${phoneDigits}`, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al enviar OTP');
      confirmationRef.current = data.sessionId;
      setOtpSent(true);
    } catch (err: any) {
      const msg = friendlyAuthError(err);
      if (msg) setError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  // Verificar OTP
  const handleVerifyOtp = async () => {
    const clean = otp.replace(/[^0-9]/g, '');
    if (clean.length !== 6) {
      setError('Ingresa los 6 dígitos del código');
      return;
    }
    if (!confirmationRef.current) {
      setError('La sesión de verificación expiró. Por favor solicita un nuevo código.');
      setOtpSent(false);
      setOtp('');
      return;
    }
    if (!selectedRole) return;

    setOtpLoading(true);
    setError(null);
    setRbacError(false);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: confirmationRef.current, code: clean, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Código incorrecto');
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user.role === 'STORE' ? 'ferreteria' : 'constructor');
    } catch (err: any) {
      if (err instanceof RbacError) { setRbacError(true); }
      else setError(friendlyAuthError(err));
    } finally {
      setOtpLoading(false);
    }
  };

  const resetOtp = async () => {
    setOtp('');
    setOtpSent(false);
    setError(null);
    recaptchaRef.current = null;
    confirmationRef.current = null;
    await handleSendOtp();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PASO 0: Splash
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div
        className={`h-screen bg-ferry-500 flex items-center justify-center flex-col gap-4
          ${splashPhase === 'fadeout' ? 'animate-splash-fade-out' : 'animate-in fade-in duration-700'}`}
      >
        <div className="relative">
          {splashPhase === 'revving' && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex flex-col items-end gap-[3px] pr-1">
              {[70, 55, 80, 45, 65, 50, 72].map((w, i) => (
                <div key={i} className={`h-[2.5px] rounded-full bg-white/70 animate-speed-line-${i + 1}`}
                  style={{ width: w }} />
              ))}
            </div>
          )}
          <img
            src={ferryLogoBlanco}
            alt="Ferry"
            className={`h-36 w-36 object-contain drop-shadow-2xl
              ${splashPhase === 'revving' ? 'animate-revving' : 'animate-gentle-float'}`}
          />
        </div>
        <p className="text-white/70 text-sm font-medium tracking-widest animate-pulse">
          Cargando ecosistema...
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASO 1: Selección de Rol
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-6 duration-500">

        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-10 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-lg shadow-slate-200/60">
            <img src={ferryLogo} alt="Ferry" className="h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center leading-snug">
            Bienvenido a <span className="text-ferry-600">Ferry</span>
          </h1>
          <p className="text-slate-400 text-sm text-center">
            ¿Cómo vas a usar la plataforma?
          </p>
        </div>

        {/* Role cards */}
        <div className="w-full max-w-sm space-y-4">

          {/* Contratista */}
          <button
            id="role-btn-contratista"
            onClick={() => selectRole('constructor')}
            className="w-full p-5 bg-white rounded-3xl border-2 border-slate-100 shadow-sm
              flex items-center gap-4 group transition-all duration-200
              hover:border-ferry-400 hover:shadow-lg hover:shadow-ferry-100/50 active:scale-[0.98]"
          >
            <div className="w-14 h-14 bg-ferry-50 rounded-2xl flex items-center justify-center
              group-hover:bg-ferry-100 transition-colors ring-4 ring-ferry-50 group-hover:ring-ferry-100">
              <Hammer className="w-7 h-7 text-ferry-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-800 text-base leading-tight">Soy Contratista</p>
              <p className="text-xs text-slate-400 mt-0.5">Pide materiales y gestiona tus obras</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-ferry-500 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Ferretería */}
          <button
            id="role-btn-ferreteria"
            onClick={() => selectRole('ferreteria')}
            className="w-full p-5 bg-white rounded-3xl border-2 border-slate-100 shadow-sm
              flex items-center gap-4 group transition-all duration-200
              hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100/50 active:scale-[0.98]"
          >
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center
              group-hover:bg-amber-100 transition-colors ring-4 ring-amber-50 group-hover:ring-amber-100">
              <Store className="w-7 h-7 text-amber-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-800 text-base leading-tight">Soy Ferretería</p>
              <p className="text-xs text-slate-400 mt-0.5">Recibe pedidos y haz crecer tu negocio</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Invitado */}
          {onGuestLogin && (
            <button
              onClick={onGuestLogin}
              className="w-full py-4 rounded-2xl text-slate-400 text-sm font-medium
                hover:text-slate-600 transition-colors border-2 border-dashed border-slate-200
                hover:border-slate-300 hover:bg-slate-50"
            >
              Continuar sin registrarme →
            </button>
          )}
        </div>

        <p className="text-slate-300 text-xs mt-10">Ferry App v2.0</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASO 2: Métodos de acceso
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 2) {
    const isStore = selectedRole === 'ferreteria';
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-right duration-400">

        {/* Hero banner */}
        <div className={`bg-gradient-to-br ${accent.hero} px-6 pt-safe-top pb-10 flex flex-col items-center text-center`}
          style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
        >
          <img src={ferryLogo} alt="Ferry" className="h-9 object-contain mb-4 opacity-90" />
          <h1 className="text-2xl font-bold text-white leading-tight">
            {isStore ? 'Panel Ferretería' : '¡Hola, Contratista!'}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            {isStore ? 'Gestiona pedidos y vende más' : 'Encuentra los mejores materiales'}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-8 max-w-sm mx-auto w-full space-y-5">

          {/* Back + step dots */}
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Cambiar rol
            </button>
            <StepDots current={1} total={3} />
          </div>

          {/* RBAC error */}
          {rbacError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-3 duration-300">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1 leading-snug">
                Esta cuenta no tiene permisos para este panel. Verifica tu tipo de registro.
              </p>
              <button onClick={() => setRbacError(false)}>
                <X className="w-4 h-4 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Google */}
          <button
            id="auth-btn-google"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full py-4 px-5 bg-white border-2 border-slate-200 rounded-2xl
              flex items-center gap-4 shadow-sm
              hover:border-slate-400 hover:shadow-md transition-all duration-200 active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 shadow-xs bg-white">
              <GoogleLogo />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-slate-800 text-sm">Continuar con Google</p>
              <p className="text-xs text-slate-400">Rápido y seguro</p>
            </div>
            {googleLoading
              ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              : <ArrowRight className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">o ingresa con celular</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Phone */}
          <button
            id="auth-btn-phone"
            onClick={() => setStep(3)}
            className={`w-full py-4 px-5 bg-white border-2 border-slate-200 rounded-2xl
              flex items-center gap-4 shadow-sm
              hover:${accent.border} hover:shadow-md transition-all duration-200 active:scale-[0.98]`}
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-slate-800 text-sm">Continuar con Celular</p>
              <p className="text-xs text-slate-400">Te enviamos un código SMS gratis</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </button>

          {/* Guest */}
          {onGuestLogin && (
            <button
              onClick={onGuestLogin}
              className="w-full text-center text-sm text-slate-400 font-medium hover:text-ferry-600 transition-colors py-2"
            >
              Continuar sin cuenta →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASO 3: Autenticación por teléfono
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-right duration-400">

      {/* Hero */}
      <div className={`bg-gradient-to-br ${accent.hero} px-6 pb-8 flex flex-col items-center text-center`}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-4 ring-4 ring-white/20">
          <Phone className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">
          {otpSent ? 'Ingresa el código' : 'Tu número de celular'}
        </h1>
        <p className="text-white/75 text-sm mt-1">
          {otpSent
            ? `Enviamos un SMS a +57 ${phone}`
            : 'Te enviaremos un código de 6 dígitos'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-8 max-w-sm mx-auto w-full space-y-6">

        {/* Back + step dots */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setOtpSent(false); setOtp(''); setError(null); setStep(2); }}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {otpSent ? 'Cambiar número' : 'Volver'}
          </button>
          <StepDots current={2} total={3} />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
            <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* RBAC error */}
        {rbacError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 flex-1">Cuenta no autorizada para este panel.</p>
            <button onClick={() => setRbacError(false)}>
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* ── Ingreso del número ── */}
        {!otpSent ? (
          <div className="space-y-4 animate-in fade-in duration-300">

            {/* Phone input */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-600
                bg-slate-100 px-2 py-1 rounded-lg pointer-events-none select-none">
                +57
              </span>
              <input
                id="phone-input"
                type="tel"
                inputMode="numeric"
                placeholder="300 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                maxLength={13}
                autoFocus
                className="w-full pl-20 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl
                  text-lg font-semibold tracking-widest text-slate-800 placeholder:text-slate-300
                  focus:border-ferry-500 focus:ring-2 focus:ring-ferry-100 focus:bg-white
                  outline-none transition-all duration-200"
              />
            </div>

            {/* Recaptcha — en dev muestra checkbox, en producción es invisible */}
            <div id="recaptcha-container" className="flex justify-center" />

            {/* CTA */}
            <button
              id="btn-send-otp"
              onClick={handleSendOtp}
              disabled={otpLoading || phone.replace(/\D/g, '').length < 10}
              className={`w-full py-4 rounded-2xl font-bold text-white text-sm
                bg-gradient-to-r ${accent.hero} shadow-lg
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100`}
            >
              {otpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando SMS...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" /> Enviar código por SMS
                </span>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 leading-relaxed">
              Al continuar aceptas los{' '}
              <button className="text-ferry-600 font-medium underline-offset-2 hover:underline">
                Términos y Condiciones
              </button>
            </p>
          </div>

        ) : (

          /* ── Ingreso del código OTP ── */
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">

            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={otpLoading}
            />

            {/* Verificar */}
            <button
              id="btn-verify-otp"
              onClick={handleVerifyOtp}
              disabled={otpLoading || otp.replace(/[^0-9]/g, '').length < 6}
              className={`w-full py-4 rounded-2xl font-bold text-white text-sm
                bg-gradient-to-r ${accent.hero} shadow-lg
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {otpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Verificar código
                </span>
              )}
            </button>

            {/* Reenviar */}
            <button
              onClick={resetOtp}
              disabled={otpLoading}
              className="w-full text-center text-sm font-semibold text-ferry-600 hover:text-ferry-700 transition-colors disabled:opacity-50"
            >
              Reenviar código
            </button>

          </div>
        )}
      </div>
    </div>
  );
};
