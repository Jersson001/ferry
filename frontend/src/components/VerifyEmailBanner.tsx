/**
 * VerifyEmailBanner.tsx
 * Banner informativo que se muestra cuando el usuario aún no ha verificado su email.
 * Permite reenviar el correo de verificación.
 */

import React, { useState } from 'react';
import { Mail, X, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { resendVerification } from '../services/authService';

interface Props {
  email: string;
  onDismiss?: () => void;
}

export const VerifyEmailBanner: React.FC<Props> = ({ email, onDismiss }) => {
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleResend = async () => {
    if (loading || sent) return;
    setLoading(true);
    setError(null);
    try {
      await resendVerification(email);
      setSent(true);
      // Resetear el estado de "enviado" después de 30 segundos
      setTimeout(() => setSent(false), 30000);
    } catch (err: any) {
      setError(err?.message ?? 'Error al reenviar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-3">
      {/* Ícono */}
      <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        {sent
          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
          : <Mail className="w-4 h-4 text-amber-600" />
        }
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-800">
          {sent ? '¡Correo reenviado! 📬' : 'Verifica tu correo electrónico'}
        </p>
        <p className="text-xs text-amber-700 mt-0.5 leading-snug">
          {sent
            ? `Revisa tu bandeja en ${email}`
            : `Te enviamos un enlace de verificación a ${email}`
          }
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

        {/* Botón reenviar */}
        {!sent && (
          <button
            onClick={handleResend}
            disabled={loading}
            className="mt-1.5 text-xs font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors flex items-center gap-1 disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando…</>
              : <><RefreshCw className="w-3 h-3" /> Reenviar correo de verificación</>
            }
          </button>
        )}
      </div>

      {/* Cerrar */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
