const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
const getToken = () => localStorage.getItem('access_token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

export interface ProjectFeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  budgetInCents?: number;
  location: string;
  isUrgent: boolean;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  postedBy: string;
  applicationCount?: number;
  postType?: 'STANDARD' | 'MULTIMEDIA' | 'VIP';
  mediaUrls?: string[];
}

export interface ProjectApplication {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  proposal: string;
  estimatedPriceInCents: number;
  createdAt: string;
  contractor: {
    uid: string;
    displayName: string;
    photoURL?: string;
    description?: string;
    specialties?: string[];
    isProfileComplete?: boolean;
  };
}

// ── CREAR PROYECTO ──────────────────────────────────────────────────────────
export const createProject = async (data: {
  title: string;
  description: string;
  category: string;
  location: string;
  exactAddress?: string;
  contactPhone?: string;
  budgetInCents?: number;
  isUrgent?: boolean;
  postType?: 'STANDARD' | 'MULTIMEDIA' | 'VIP';
  mediaUrls?: string[];
}): Promise<ProjectFeedItem> => {
  const res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al publicar el proyecto');
  }
  return res.json();
};

export const getProjectWompiSignature = async (type: string): Promise<{
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
}> => {
  const res = await fetch(`${API_URL}/projects/wompi/signature/${type}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error obteniendo la firma de pago de Wompi');
  return res.json();
};

// ── MIS PROYECTOS ───────────────────────────────────────────────────────────
export const getMyProjects = async (): Promise<ProjectFeedItem[]> => {
  const res = await fetch(`${API_URL}/projects/own`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al cargar tus proyectos');
  return res.json();
};

// ── CANCELAR PROYECTO ───────────────────────────────────────────────────────
export const cancelProject = async (projectId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al cancelar el proyecto');
  }
};

// ── VER POSTULADOS ──────────────────────────────────────────────────────────
export const getProjectApplications = async (projectId: string): Promise<ProjectApplication[]> => {
  const res = await fetch(`${API_URL}/projects/${projectId}/applications`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al cargar postulados');
  return res.json();
};

// ── CONTRATAR (ACEPTAR POSTULACIÓN) ────────────────────────────────────────
export const acceptApplication = async (
  projectId: string,
  appId: string
): Promise<{ revealedAddress?: string; revealedPhone?: string }> => {
  const res = await fetch(`${API_URL}/projects/${projectId}/applications/${appId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al aceptar la postulación');
  }
  return res.json();
};

// ── FEED DE OPORTUNIDADES (CONTRATISTA) ─────────────────────────────────────
export const getProjectFeed = async (): Promise<ProjectFeedItem[]> => {
  const res = await fetch(`${API_URL}/projects`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al cargar el muro de oportunidades');
  return res.json();
};

// ── POSTULARME ───────────────────────────────────────────────────────────────
export const applyToProject = async (
  projectId: string,
  data: { proposal: string; estimatedPriceInCents: number }
): Promise<void> => {
  const res = await fetch(`${API_URL}/projects/${projectId}/apply`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al enviar tu postulación');
  }
};

// ── MIS POSTULACIONES (CONTRATISTA) ──────────────────────────────────────────
export const getMyApplications = async () => {
  const res = await fetch(`${API_URL}/projects/my-applications`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al cargar tus postulaciones');
  return res.json();
};
