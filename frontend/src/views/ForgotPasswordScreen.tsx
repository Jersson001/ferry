/**
 * ForgotPasswordScreen.tsx
 * Pantalla para solicitar el restablecimiento de contraseña.
 * El usuario ingresa su email y recibe un correo con un enlace.
 */

import React, { useState } from 'react';
import { ArrowLeft, Mail, Loader2, CheckCircle2, Send } from 'lucide-react';
import ferryLogoBlanco from '../assets/Logo Ferry3 - Blanco.png';
import { forgotPassword } from '../services/authService';

interface Props {
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<Props> = ({ onBack }) => {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  // ── Estado: email enviado ──
  if (sent) {
    return (
      <div className="h-screen flex flex-col bg-slate-50">
        <div className="relative bg-gradient-to-br from-ferry-600 to-ferry-500 px-6 pt-12 pb-14 text-white overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
          <img src={ferryLogoBlanco} alt="Ferry" className="h-8 object-contain mb-3" />
          <h1 className="text-xl font-black">Revisa tu correo 📬</h1>
          <p className="text-white/75 text-sm mt-0.5">Te enviamos las instrucciones</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800">¡Correo enviado!</h2>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs">
              Si <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
            </p>
            <p className="text-slate-400 text-xs mt-3">
              Revisa también tu carpeta de spam o correo no deseado.
            </p>
          </div>

          <div className="w-full space-y-3 mt-2">
            <button
              onClick={onBack}
              className="w-full py-4 bg-ferry-600 text-white font-bold rounded-2xl hover:bg-ferry-700 transition-colors"
            >
              Volver al inicio de sesión
            </button>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="w-full py-3 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
            >
              Usar otro correo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ──
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-ferry-600 to-ferry-500 px-6 pt-12 pb-14 text-white overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <img src={ferryLogoBlanco} alt="Ferry" className="h-8 object-contain mb-3" />
        <h1 className="text-xl font-black leading-tight">¿Olvidaste tu contraseña?</h1>
        <p className="text-white/75 text-sm mt-0.5">
          Ingresa tu correo y te enviamos un enlace para restablecerla
        </p>
      </div>

      {/* Formulario */}
      <div className="flex-1 px-5 py-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Ilustración */}
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-ferry-100 rounded-3xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-ferry-600" />
            </div>
          </div>

          {/* Campo de email */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Correo electrónico
            </label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ferry-300 focus:border-ferry-400 transition"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Botón */}
          <button
            id="btn-send-reset"
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all shadow-lg bg-ferry-600 hover:bg-ferry-700 focus:outline-none focus:ring-2 focus:ring-ferry-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar enlace de recuperación
              </>
            )}
          </button>

          {/* Link volver */}
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-ferry-600 underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </form>

        {/* Info card */}
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
            ¿Cómo funciona?
          </p>
          <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
            <li>Recibirás un enlace en tu correo</li>
            <li>El enlace es válido por 1 hora</li>
            <li>Solo puede usarse una vez</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
