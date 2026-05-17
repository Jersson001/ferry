/**
 * ResetPasswordScreen.tsx
 * Pantalla para crear una nueva contraseña usando el token del email.
 * Se muestra cuando la URL contiene ?token=xxx (desde el correo de recuperación).
 */

import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import ferryLogoBlanco from '../assets/Logo Ferry3 - Blanco.png';
import { resetPassword } from '../services/authService';

interface Props {
  token: string;
  onSuccess: () => void; // Callback: ir al login
}

// ── Indicador de fortaleza ────────────────────────────────────────────────────
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
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? colors[strength - 1] : 'bg-slate-100'}`} />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {checks.map((c, i) => (
          <span key={i} className={`text-[10px] font-medium transition-colors ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
export const ResetPasswordScreen: React.FC<Props> = ({ token, onSuccess }) => {
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [done,        setDone]        = useState(false);

  // Si no hay token, mostrar error inmediatamente
  const hasToken = Boolean(token?.trim());

  const isValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirmPass;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !hasToken) return;

    if (password !== confirmPass) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // ── Estado: éxito ──
  if (done) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 px-6 gap-6">
        <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">¡Contraseña restablecida!</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs">
            Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
        </div>
        <button
          onClick={onSuccess}
          className="w-full max-w-xs py-4 bg-ferry-600 text-white font-bold rounded-2xl hover:bg-ferry-700 transition-colors shadow-lg"
        >
          🔐 Iniciar sesión
        </button>
      </div>
    );
  }

  // ── Token inválido ──
  if (!hasToken) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 px-6 gap-6">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center shadow-lg">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Enlace inválido</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs">
            Este enlace de recuperación no es válido o ya fue usado. Solicita uno nuevo.
          </p>
        </div>
        <button
          onClick={onSuccess}
          className="w-full max-w-xs py-4 bg-ferry-600 text-white font-bold rounded-2xl hover:bg-ferry-700 transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-ferry-600 to-ferry-500 px-6 pt-12 pb-14 text-white overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <img src={ferryLogoBlanco} alt="Ferry" className="h-8 object-contain mb-3" />
        <h1 className="text-xl font-black leading-tight">Nueva contraseña 🔑</h1>
        <p className="text-white/75 text-sm mt-0.5">Crea una contraseña segura para tu cuenta</p>
      </div>

      {/* Formulario */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Nueva contraseña */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Nueva contraseña
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reset-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                autoFocus
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ferry-300 focus:border-ferry-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Confirmar contraseña
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reset-confirm-password"
                type={showPass ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => { setConfirmPass(e.target.value); setError(null); }}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-2xl text-sm outline-none focus:ring-2 transition ${
                  confirmPass && password !== confirmPass
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-slate-200 focus:ring-ferry-300 focus:border-ferry-400'
                }`}
              />
            </div>
            {confirmPass && password !== confirmPass && (
              <p className="text-xs text-red-500 mt-1 ml-1">Las contraseñas no coinciden</p>
            )}
          </div>

          {/* Error del servidor */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Botón */}
          <button
            id="btn-reset-password"
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all shadow-lg bg-ferry-600 hover:bg-ferry-700 focus:outline-none focus:ring-2 focus:ring-ferry-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando…
              </>
            ) : (
              '✅ Guardar nueva contraseña'
            )}
          </button>
        </form>

        {/* Requisitos */}
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            Requisitos de contraseña
          </p>
          <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
            <li>Mínimo 8 caracteres</li>
            <li>Al menos una letra mayúscula (A–Z)</li>
            <li>Al menos un número (0–9)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
