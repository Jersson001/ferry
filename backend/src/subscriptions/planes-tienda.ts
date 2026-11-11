import { SubscriptionPlan } from './entities/subscription-plan.entity';

type DefinicionPlan = Partial<SubscriptionPlan> & { name: string; nombresAnteriores: string[] };

// Planes para ferreterías. Se sincronizan con la base en cada arranque, igual que los de usuario.
// maxQuotesPerDay: solicitudes que la ferretería puede cotizar por día (-1 = sin límite). Los créditos
// (credits / maxLeadsOrApplications) son los de Smart Match, la IA que arma la cotización desde el catálogo.
export const PLANES_TIENDA: DefinicionPlan[] = [
  {
    name: 'Gratuito',
    nombresAnteriores: [],
    targetRole: 'STORE',
    priceInCents: 0,
    credits: 10,
    maxLeadsOrApplications: 10,
    maxQuotesPerDay: 5,
    maxPortfolioItems: 6,
    hasVerifiedBadge: false,
    isPopular: false,
    features: [
      'Cotiza hasta 5 solicitudes al día',
      'Edición del perfil y carga del catálogo',
    ],
  },
  {
    name: 'Profesional',
    nombresAnteriores: [],
    targetRole: 'STORE',
    priceInCents: 6_000_000, // $60.000
    credits: 40,
    maxLeadsOrApplications: 40,
    maxQuotesPerDay: 40,
    maxPortfolioItems: 20,
    hasVerifiedBadge: true,
    isPopular: true,
    features: [
      'Cotiza hasta 40 solicitudes al día',
      'Productos destacados',
      'Perfil verificado con calificaciones',
    ],
  },
  {
    name: 'Empresarial',
    nombresAnteriores: [],
    targetRole: 'STORE',
    priceInCents: 11_000_000, // $110.000
    credits: 100,
    maxLeadsOrApplications: 100,
    maxQuotesPerDay: 80,
    maxPortfolioItems: 50,
    hasVerifiedBadge: true,
    isPopular: false,
    features: [
      'Cotiza hasta 80 solicitudes al día',
      'Visibilidad del perfil en el inicio',
      'Productos destacados',
      'Perfil verificado con calificaciones',
    ],
  },
  {
    name: 'Distribuidor Elite',
    nombresAnteriores: [],
    targetRole: 'STORE',
    priceInCents: 33_000_000, // $330.000
    credits: 9999,
    maxLeadsOrApplications: -1,
    maxQuotesPerDay: -1,
    maxPortfolioItems: -1,
    hasVerifiedBadge: true,
    isPopular: false,
    features: [
      'Solicitudes ilimitadas',
      'Análisis de precios',
      'Máxima prioridad',
      'Perfil verificado con calificaciones',
    ],
  },
];
