import React, { useState, useEffect } from 'react';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './UIComponents';
import { Mail, Phone, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

interface AuthFormProps {
  onSuccess: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const auth = getAuth();

  useEffect(() => {
    if (method === 'phone') {
      try {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      } catch (err) {
        console.error("Recaptcha error:", err);
      }
    }
  }, [method, auth]);

  const saveUserProfile = async (uid: string, data: { email?: string, phoneNumber?: string }) => {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid,
        ...data,
        role: UserRole.USER,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserProfile(userCredential.user.uid, { email });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
    } catch (err: any) {
      console.error("Phone submit error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      const result = await confirmationResult.confirm(verificationCode);
      if (result.user) {
        await saveUserProfile(result.user.uid, { phoneNumber: result.user.phoneNumber || phoneNumber });
      }
      onSuccess();
    } catch (err: any) {
      console.error("Code verify error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => { setMethod('email'); setConfirmationResult(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${method === 'email' ? 'bg-white shadow-sm text-ferry-600' : 'text-slate-500'}`}
        >
          Email
        </button>
        <button
          onClick={() => { setMethod('phone'); setConfirmationResult(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${method === 'phone' ? 'bg-white shadow-sm text-ferry-600' : 'text-slate-500'}`}
        >
          Teléfono
        </button>
      </div>

      {method === 'email' ? (
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
      ) : (
        <div className="space-y-4">
          {!confirmationResult ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Número de Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+57 300 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ferry-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div id="recaptcha-container"></div>
              {error && <p className="text-red-500 text-xs font-medium ml-1">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full py-4 shadow-lg shadow-ferry-100">
                {loading ? 'Enviando SMS...' : 'Enviar Código de Verificación'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeVerify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Código de Verificación</label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ferry-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs font-medium ml-1">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full py-4 shadow-lg shadow-ferry-100">
                {loading ? 'Verificando...' : 'Verificar Código'}
              </Button>
              <button
                type="button"
                onClick={() => setConfirmationResult(null)}
                className="w-full text-center text-sm text-slate-500 font-medium hover:text-ferry-600 transition-colors"
              >
                Cambiar número
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
