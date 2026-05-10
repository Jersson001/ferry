/**
 * AuthForm.tsx
 * Formulario de autenticación legacy — redirige a Login/Register via useApi.
 * No usa Firebase. Solo soporta autenticación por email.
 */
import React, { useState } from 'react';
import { Button } from './UIComponents';
import { Mail, Lock } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface AuthFormProps {
  onSuccess: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const { signInWithEmail, registerWithEmail } = useApi();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        await registerWithEmail(email, password, 'constructor', 'Usuario');
      } else {
        await signInWithEmail(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Correo Electrónico</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ferry-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ferry-500 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-xs font-medium ml-1">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full py-4 shadow-lg shadow-ferry-100">
          {loading ? 'Cargando...' : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </Button>

        <button
          type="button"
          onClick={() => setIsRegistering(!isRegistering)}
          className="w-full text-center text-sm text-slate-500 font-medium hover:text-ferry-600 transition-colors"
        >
          {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </form>
    </div>
  );
};
