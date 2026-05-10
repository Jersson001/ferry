/**
 * authService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de autenticación que ahora se conecta al backend de NestJS en vez de Firebase.
 */

import { UserRole, UserProfile } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

export async function registerWithEmail(email: string, password: string, role: FerryRole): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email, 
      password, 
      role: role === 'ferreteria' ? 'STORE' : 'USER',
      displayName: role === 'ferreteria' ? 'Mi Ferretería' : 'Usuario'
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
  return err?.message ?? 'Error de autenticación.';
}
