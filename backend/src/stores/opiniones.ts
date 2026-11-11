export const MAX_TEXTO_OPINION = 300;

export interface FilaOpinion {
  id: string;
  rating: number | string;
  reviewComment: string | null;
  reviewReply: string | null;
  reviewedAt: Date | string | null;
  reviewRepliedAt: Date | string | null;
  authorName: string | null;
}

export interface Opinion {
  id?: string;
  rating: number;
  comment: string;
  author: string;
  date: string | null;
  reply: string | null;
  repliedAt: string | null;
}

// En una opinión pública solo se ve el primer nombre: lo que importa es lo que dijo, no quién es.
export function primerNombre(nombre: string | null | undefined): string {
  const palabra = (nombre ?? '').trim().split(/\s+/)[0];
  return palabra && !palabra.includes('@') ? palabra : 'Cliente';
}

// Texto libre de una opinión o de su respuesta: sin espacios sobrantes, con tope de largo; vacío => null.
export function limpiarTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim().slice(0, MAX_TEXTO_OPINION);
  return t === '' ? null : t;
}

const aIso = (d: Date | string | null): string | null => {
  if (!d) return null;
  const f = new Date(d);
  return Number.isNaN(f.getTime()) ? null : f.toISOString();
};

// `conId` solo lo usa la propia tienda para poder responder; en lo público no se expone el id de la cotización.
export function armarOpiniones(filas: FilaOpinion[], conId = false): Opinion[] {
  const r: Opinion[] = [];
  for (const f of filas) {
    const rating = Number(f.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    r.push({
      ...(conId ? { id: f.id } : {}),
      rating,
      comment: f.reviewComment?.trim() ?? '',
      author: primerNombre(f.authorName),
      date: aIso(f.reviewedAt),
      reply: f.reviewReply?.trim() || null,
      repliedAt: aIso(f.reviewRepliedAt),
    });
  }
  return r;
}
