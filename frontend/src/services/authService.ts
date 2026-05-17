/**
 * authService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de autenticación que se conecta al backend de NestJS.
 */

import { UserRole, UserProfile } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export type FerryRole = 'constructor' | 'ferreteria';

export interface AuthResult {
  role: FerryRole;
  isNew: boolean;
}

export class RbacError extends Error {
  constructor() {
    super('Esta cuenta no tiene permiso para este panel.');
    this.name = 'RbacError';
  }
}

const mapRole = (role: string): FerryRole =>
  role === 'STORE' ? 'ferreteria' : 'constructor';

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error de autenticación.');
  }

  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return { role: mapRole(data.user.role), isNew: false };
}

export async function registerWithEmail(email: string, password: string, role: string, displayName?: string): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      role,
      displayName: displayName || (role === 'STORE' ? 'Mi Ferretería' : 'Usuario')
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error de registro.');
  }

  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return { role: mapRole(data.user.role), isNew: true };
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al procesar la solicitud.');
  }

  return response.json();
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al restablecer la contraseña.');
  }

  return response.json();
}

export async function verifyEmailToken(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al verificar el correo.');
  }

  return response.json();
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al reenviar el correo.');
  }

  return response.json();
}

export function getCurrentUser(): UserProfile | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  const user = JSON.parse(userStr);
  return {
    ...user,
    role: user.role === 'STORE' ? UserRole.STORE : UserRole.USER,
    createdAt: new Date(),
  };
}

export function signOut(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function friendlyAuthError(err: any): string {
  if (err instanceof RbacError) return err.message;
  const msg: string = err?.message ?? '';
  if (msg.includes('ya está registrado')) return msg;
  if (msg.includes('contraseña incorrectos')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('expirado')) return msg;
  if (msg.includes('válido o ya fue usado')) return msg;
  return msg || 'Error de autenticación.';
}
