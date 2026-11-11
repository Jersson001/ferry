import { EntityManager, MoreThanOrEqual } from 'typeorm';
import { User } from '../users/user.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription, SubscriptionStatus } from './entities/user-subscription.entity';
import { UsageLog } from './entities/usage-log.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectApplication } from '../projects/entities/project-application.entity';

// Funciones sobre un EntityManager (no un servicio) para que proyectos, cotizaciones, IA y pagos las usen
// sin crear dependencias circulares entre módulos, y dentro de sus propias transacciones.

// Lo que cuesta ver el contacto de un cliente cuando el plan no lo incluye, en centavos de COP.
export const PRECIO_CONTACTO_SUSCRITO = 990_000; // $9.900 con plan de pago vigente
export const PRECIO_CONTACTO_GRATIS = 1_400_000; // $14.000 en el plan gratuito

// Cotizaciones por solicitud si no hay plan que diga otra cosa (y para solicitudes anteriores a los cupos).
export const COTIZACIONES_POR_DEFECTO = 5;

const SIN_LIMITE = -1;
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000; // Colombia es UTC-5 todo el año

export interface Limites {
  transcripcionesIa: number;
  proyectos: number;
  tiendasPorSolicitud: number;
  postulaciones: number;
  contactosIncluidos: number;
}

export interface PlanVigente {
  nombre: string;
  pago: boolean; // Plan de pago vigente
  verificado: boolean;
  inicio: Date; // Desde aquí se cuentan los cupos
  fin: Date; // Cuando se reinician (o vence el plan de pago)
  limites: Limites;
}

export interface Uso {
  transcripcionesIa: number;
  proyectos: number;
  postulaciones: number;
  contactosIncluidos: number;
}

// Primer instante del mes calendario en Colombia, y del siguiente.
export function mesColombia(ahora: Date = new Date()): { inicio: Date; fin: Date } {
  const local = new Date(ahora.getTime() - OFFSET_BOGOTA_MS);
  const inicio = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + OFFSET_BOGOTA_MS;
  const fin = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) + OFFSET_BOGOTA_MS;
  return { inicio: new Date(inicio), fin: new Date(fin) };
}

const limitesDe = (p: SubscriptionPlan | null): Limites => ({
  transcripcionesIa: p?.aiTranscriptionsPerMonth ?? SIN_LIMITE,
  proyectos: p?.maxProjectsPerMonth ?? SIN_LIMITE,
  tiendasPorSolicitud: p?.maxQuotesPerRequest ?? COTIZACIONES_POR_DEFECTO,
  postulaciones: p?.maxLeadsOrApplications ?? SIN_LIMITE,
  contactosIncluidos: p?.includedContactsPerMonth ?? 0,
});

/**
 * El plan que rige hoy para el usuario: el de pago si está activo y no ha vencido; si no, el gratuito de su
 * tipo de cuenta, con cupos por mes calendario. Los administradores no tienen límites.
 */
export async function planVigente(manager: EntityManager, userId: string, ahora: Date = new Date()): Promise<PlanVigente> {
  const user = await manager.findOne(User, { where: { uid: userId }, select: ['uid', 'role'] });
  const mes = mesColombia(ahora);

  if (user?.role === 'ADMIN') {
    return {
      nombre: 'Administrador', pago: true, verificado: true, ...mes,
      limites: { transcripcionesIa: SIN_LIMITE, proyectos: SIN_LIMITE, tiendasPorSolicitud: 10, postulaciones: SIN_LIMITE, contactosIncluidos: SIN_LIMITE },
    };
  }

  const targetRole = user?.role === 'STORE' ? 'STORE' : 'CONTRACTOR';
  const sub = await manager.findOne(UserSubscription, { where: { userId }, relations: ['plan'] });
  const plan = sub?.plan;
  const vigente = !!plan && plan.priceInCents > 0 && plan.targetRole === targetRole
    && sub!.status === SubscriptionStatus.ACTIVE && !!sub!.currentPeriodEnd && sub!.currentPeriodEnd > ahora;

  if (vigente) {
    const fin = sub!.currentPeriodEnd;
    let inicio = sub!.currentPeriodStart ?? null;
    if (!inicio) {
      inicio = new Date(fin);
      inicio.setMonth(inicio.getMonth() - 1);
    }
    return { nombre: plan!.name, pago: true, verificado: plan!.hasVerifiedBadge, inicio, fin, limites: limitesDe(plan!) };
  }

  const gratis = await manager.findOne(SubscriptionPlan, { where: { targetRole, priceInCents: 0 } });
  return { nombre: gratis?.name ?? 'Gratuito', pago: false, verificado: false, ...mes, limites: limitesDe(gratis) };
}

// Lo que el usuario ya gastó de cada cupo desde `inicio`.
export async function usoDesde(manager: EntityManager, userId: string, inicio: Date): Promise<Uso> {
  const desde = MoreThanOrEqual(inicio);
  const [transcripcionesIa, proyectos, postulaciones, contactosIncluidos] = await Promise.all([
    manager.count(UsageLog, { where: { userId, kind: 'AI', createdAt: desde } }),
    manager.count(Project, { where: { userId, createdAt: desde } }),
    manager.count(ProjectApplication, { where: { contractorId: userId, createdAt: desde } }),
    manager.count(ProjectApplication, { where: { contractorId: userId, contactSource: 'PLAN', contactUnlockedAt: desde } }),
  ]);
  return { transcripcionesIa, proyectos, postulaciones, contactosIncluidos };
}

export const quedaCupo = (limite: number, usados: number) => limite === SIN_LIMITE || usados < limite;

export const precioContacto = (plan: PlanVigente) => (plan.pago ? PRECIO_CONTACTO_SUSCRITO : PRECIO_CONTACTO_GRATIS);

const fecha = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

// Mensaje cuando se acaba un cupo: qué se acabó y cuándo vuelve.
export const mensajeSinCupo = (plan: PlanVigente, que: string, limite: number) =>
  `Tu plan ${plan.nombre} incluye ${limite} ${que} al mes y ya llegaste a ese límite. ` +
  (plan.pago ? `Se renuevan el ${fecha(plan.fin)}, o mejora tu plan para tener más.` : `Se renuevan el ${fecha(plan.fin)}, o suscríbete a un plan para tener más.`);
