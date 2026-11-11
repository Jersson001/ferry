import { SubscriptionPlan } from './entities/subscription-plan.entity';

type DefinicionPlan = Partial<SubscriptionPlan> & { name: string; nombresAnteriores: string[] };

// Planes para usuarios (antes "contratistas y maestros"). Se sincronizan con la base en cada arranque.
// -1 = sin límite. Los cupos son por mes; el contacto que el plan no incluya cuesta $9.900 con plan de pago
// y $14.000 en el gratuito (ver plan-vigente.ts).
export const PLANES_USUARIO: DefinicionPlan[] = [
  {
    name: 'Ferry Free',
    nombresAnteriores: ['Gratuito'],
    targetRole: 'CONTRACTOR',
    priceInCents: 0,
    credits: 0,
    aiTranscriptionsPerMonth: 10,
    maxProjectsPerMonth: 5,
    maxQuotesPerRequest: 3,
    maxLeadsOrApplications: -1,
    includedContactsPerMonth: 0,
    maxPortfolioItems: 6,
    hasVerifiedBadge: false,
    isPopular: false,
    features: [
      '10 transcripciones de IA al mes',
      'Hasta 5 proyectos publicados al mes',
      'Cotizaciones de hasta 3 ferreterías por solicitud',
      'Creación de perfil',
      'Postúlate a proyectos: si te contratan, el contacto del cliente cuesta $14.000',
    ],
  },
  {
    name: 'Ferry Maestro',
    nombresAnteriores: ['Maestro Sub'],
    targetRole: 'CONTRACTOR',
    priceInCents: 3_000_000, // $30.000
    credits: 0,
    aiTranscriptionsPerMonth: 50,
    maxProjectsPerMonth: 30,
    maxQuotesPerRequest: 6,
    maxLeadsOrApplications: 6,
    includedContactsPerMonth: 2,
    maxPortfolioItems: 15,
    hasVerifiedBadge: true,
    isPopular: false,
    features: [
      '50 transcripciones de IA al mes',
      'Hasta 30 proyectos publicados al mes',
      'Cotizaciones de hasta 6 ferreterías expertas',
      'Perfil verificado con calificaciones y comentarios',
      '6 postulaciones al mes, 2 contrataciones con el contacto del cliente incluido',
      'Contacto adicional: $9.900 por cliente',
    ],
  },
  {
    name: 'Ferry Experto',
    nombresAnteriores: ['Especialista'],
    targetRole: 'CONTRACTOR',
    priceInCents: 5_500_000, // $55.000
    credits: 0,
    aiTranscriptionsPerMonth: -1,
    maxProjectsPerMonth: 60,
    maxQuotesPerRequest: 10,
    maxLeadsOrApplications: -1,
    includedContactsPerMonth: 10,
    maxPortfolioItems: 30,
    hasVerifiedBadge: true,
    isPopular: true,
    features: [
      'Transcripciones de IA ilimitadas',
      'Hasta 60 proyectos publicados al mes',
      'Cotizaciones de hasta 10 ferreterías expertas',
      'Perfil verificado con calificaciones y comentarios',
      '10 contrataciones al mes con el contacto del cliente incluido',
      'Postulaciones adicionales: contacto a $9.900 por cliente',
    ],
  },
  {
    name: 'Ferry Pro',
    nombresAnteriores: ['Constructor Pro'],
    targetRole: 'CONTRACTOR',
    priceInCents: 33_000_000, // $330.000
    credits: 0,
    aiTranscriptionsPerMonth: -1,
    maxProjectsPerMonth: 100,
    maxQuotesPerRequest: 10,
    maxLeadsOrApplications: -1,
    includedContactsPerMonth: -1, // Sin tope: nunca paga por el contacto
    maxPortfolioItems: -1,
    hasVerifiedBadge: true,
    isPopular: false,
    features: [
      'Transcripciones de IA ilimitadas',
      'Hasta 100 proyectos publicados al mes',
      'Cotizaciones de hasta 10 ferreterías expertas',
      'Perfil verificado con calificaciones y comentarios',
      'Contacto del cliente incluido en todas tus contrataciones, sin tope',
    ],
  },
];
