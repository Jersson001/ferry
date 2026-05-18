/**
 * subscriptionService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio REST para consultar planes, estado actual de suscripción y simular compras.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    throw new Error('Sesión expirada');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error en la petición');
  return data;
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  targetRole: string;
  priceInCents: number;
  credits: number;
  maxLeadsOrApplications: number;
  maxPortfolioItems: number;
  hasVerifiedBadge: boolean;
  isPopular: boolean;
  features: string[];
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId?: string;
  plan?: SubscriptionPlan;
  status: string;
  currentPeriodEnd?: string;
  creditsBalance: number;
}

export async function getSubscriptionPlans(role?: string): Promise<SubscriptionPlan[]> {
  const query = role ? `?role=${role}` : '';
  return apiRequest<SubscriptionPlan[]>(`/subscriptions/plans${query}`);
}

export async function getMySubscription(): Promise<UserSubscription> {
  return apiRequest<UserSubscription>('/subscriptions/my-subscription');
}

export async function purchasePlan(planId: string): Promise<UserSubscription> {
  return apiRequest<UserSubscription>(`/subscriptions/purchase/${planId}`, {
    method: 'POST',
  });
}

// Endpoint de Modo Dios (ADMIN)
export async function getAdminUsersWithSubscriptions(): Promise<any[]> {
  return apiRequest<any[]>('/admin/users-with-subscriptions');
}

export async function adminAssignPlan(userId: string, planId: string): Promise<UserSubscription> {
  return apiRequest<UserSubscription>(`/admin/assign-plan/${userId}/${planId}`, {
    method: 'POST',
  });
}
