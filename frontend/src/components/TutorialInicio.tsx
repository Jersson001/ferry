import React, { useRef, useState } from 'react';
import {
  Sparkles, Camera, Inbox, ShieldCheck, PackageCheck,
  Store, Bell, Calculator, Truck, QrCode, ChevronRight, ChevronLeft, X,
} from 'lucide-react';

// Tutorial de bienvenida: tarjetas que se pasan con el dedo, distintas para cliente y ferretería.
// Se muestra una vez por cuenta y rol (marca en localStorage) y se puede volver a ver desde el perfil.

export type RolTutorial = 'cliente' | 'ferreteria';

interface Tarjeta {
  icono: React.ElementType;
  color: string; // clases de fondo y texto del ícono
  titulo: string;
  texto: string;
  puntos?: string[];
}

const TARJETAS: Record<RolTutorial, Tarjeta[]> = {
  cliente: [
    {
      icono: Sparkles, color: 'bg-ferry-100 text-ferry-600',
      titulo: 'Bienvenido a Ferry',
      texto: 'Cotiza los materiales de tu obra con las ferreterías cercanas, sin llamar ni ir de tienda en tienda.',
    },
    {
      icono: Camera, color: 'bg-orange-100 text-orange-600',
      titulo: 'Pide tus materiales',
      texto: 'Entra a Materiales y elige cómo armar tu lista:',
      puntos: [
        'Sube tu Lista: una foto, imagen o PDF, y la armamos por ti.',
        'Escribir Lista: escribe, dicta o pega el texto.',
        'Revisa las cantidades y elige hasta dónde buscar ferreterías (de 2 a 50 km).',
      ],
    },
    {
      icono: Inbox, color: 'bg-blue-100 text-blue-600',
      titulo: 'Compara cotizaciones',
      texto: 'Las ferreterías te responden en Cotizaciones → Recibidas, hasta 5 por solicitud.',
      puntos: [
        'Ves el precio, el envío y qué materiales tiene cada una.',
        'Puedes aceptar una cotización completa o solo lo que esté disponible.',
        'La ferretería se revela cuando pagas.',
      ],
    },
    {
      icono: ShieldCheck, color: 'bg-purple-100 text-purple-600',
      titulo: 'Paga seguro',
      texto: 'Paga con Nequi (apruebas en tu app) o con tarjeta o PSE. El pago se confirma al instante.',
      puntos: [
        'La ferretería recibe el aviso y empieza a alistar tu pedido.',
        'Desde ese momento ves sus datos y pueden hablar por el chat.',
      ],
    },
    {
      icono: PackageCheck, color: 'bg-green-100 text-green-600',
      titulo: 'Recibe y califica',
      texto: 'Cuando llegue tu pedido, toca Confirmar entrega y califica a la ferretería. Tu opinión ayuda a otros clientes.',
      puntos: ['¿Necesitas mano de obra? En Proyectos publicas el trabajo y los profesionales se postulan.'],
    },
  ],
  ferreteria: [
    {
      icono: Store, color: 'bg-ferry-100 text-ferry-600',
      titulo: 'Bienvenido a Ferry',
      texto: 'Recibe pedidos de clientes de tu zona y vende más sin salir a buscarlos.',
    },
    {
      icono: Bell, color: 'bg-amber-100 text-amber-600',
      titulo: 'Te llegan solicitudes',
      texto: 'En tu Panel ves las solicitudes de tus especialidades, de clientes que están dentro de tu alcance.',
      puntos: [
        'Cada solicitud recibe máximo 5 cotizaciones: responde rápido.',
        'Activa los avisos en tu Panel para enterarte apenas llegue una.',
      ],
    },
    {
      icono: Calculator, color: 'bg-blue-100 text-blue-600',
      titulo: 'Cotiza en minutos',
      texto: 'Toca Cotizar, marca lo que tienes disponible y pon tu precio y el costo del envío.',
      puntos: [
        'Ferry recuerda tus precios y los sugiere la próxima vez.',
        'Con el plan gratuito envías hasta 5 cotizaciones al día.',
      ],
    },
    {
      icono: Truck, color: 'bg-green-100 text-green-600',
      titulo: 'Cuando te pagan, alistas',
      texto: 'Te avisamos con "¡Pedido pagado!" y ves los datos del cliente y la dirección de entrega.',
      puntos: [
        'No despaches un pedido que diga "Pago en revisión".',
        'Alista el pedido y márcalo como Enviado al despacharlo.',
      ],
    },
    {
      icono: QrCode, color: 'bg-purple-100 text-purple-600',
      titulo: 'Tu catálogo te vende',
      texto: 'En Catálogo sube tus productos con precio y existencias.',
      puntos: [
        'Marca productos en oferta: aparecen en el inicio de los clientes cercanos.',
        'Comparte tu catálogo con un QR o por WhatsApp.',
      ],
    },
  ],
};

const clave = (uid: string, rol: RolTutorial) => `ferry_tutorial_${rol}_${uid}`;

/** ¿Ya vio el tutorial esta cuenta en este rol? Si el navegador no deja leer, se asume que sí (no insistir). */
export const tutorialVisto = (uid: string, rol: RolTutorial): boolean => {
  try { return localStorage.getItem(clave(uid, rol)) === '1'; } catch { return true; }
};

export const marcarTutorialVisto = (uid: string, rol: RolTutorial) => {
  try { localStorage.setItem(clave(uid, rol), '1'); } catch { /* sin almacenamiento: se verá otra vez */ }
};

export const TutorialInicio: React.FC<{ rol: RolTutorial; onTerminar: () => void }> = ({ rol, onTerminar }) => {
  const tarjetas = TARJETAS[rol];
  const [paso, setPaso] = useState(0);
  const inicioX = useRef<number | null>(null);
  const ultima = paso === tarjetas.length - 1;
  const t = tarjetas[paso];
  const Icono = t.icono;

  const ir = (n: number) => setPaso(Math.max(0, Math.min(tarjetas.length - 1, n)));

  // Deslizar con el dedo: más de 50 px cambia de tarjeta
  const alTocar = (e: React.TouchEvent) => { inicioX.current = e.touches[0].clientX; };
  const alSoltar = (e: React.TouchEvent) => {
    if (inicioX.current === null) return;
    const dx = e.changedTouches[0].clientX - inicioX.current;
    inicioX.current = null;
    if (dx < -50) ir(paso + 1);
    else if (dx > 50) ir(paso - 1);
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial de Ferry para ${rol === 'cliente' ? 'clientes' : 'ferreterías'}`}
      onTouchStart={alTocar}
      onTouchEnd={alSoltar}
    >
      {/* Barra superior: progreso y Saltar */}
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-xs font-semibold text-slate-400">{paso + 1} de {tarjetas.length}</span>
        {!ultima ? (
          <button onClick={onTerminar} className="text-sm font-semibold text-slate-500 hover:text-slate-800 px-2 py-1">
            Saltar
          </button>
        ) : (
          <button onClick={onTerminar} aria-label="Cerrar tutorial" className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tarjeta */}
      <div key={paso} className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in slide-in-from-right-4 duration-300">
        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 ${t.color}`}>
          <Icono className="w-12 h-12" strokeWidth={1.75} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-3">{t.titulo}</h2>
        <p className="text-[15px] text-slate-600 leading-relaxed">{t.texto}</p>
        {t.puntos && (
          <ul className="mt-5 space-y-2.5 text-left w-full max-w-xs">
            {t.puntos.map(p => (
              <li key={p} className="flex gap-2.5 text-sm text-slate-600 leading-snug">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ferry-500 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Puntos y botones */}
      <div className="px-6 pb-8 space-y-5">
        <div className="flex justify-center gap-2">
          {tarjetas.map((_, i) => (
            <button
              key={i}
              onClick={() => ir(i)}
              aria-label={`Ir a la tarjeta ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === paso ? 'w-6 bg-ferry-500' : 'w-2 bg-slate-200'}`}
            />
          ))}
        </div>
        <div className="flex gap-3">
          {paso > 0 && (
            <button
              onClick={() => ir(paso - 1)}
              aria-label="Anterior"
              className="w-14 flex items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => (ultima ? onTerminar() : ir(paso + 1))}
            className="flex-1 py-4 rounded-2xl bg-ferry-500 hover:bg-ferry-600 text-white font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            {ultima ? '¡Empezar!' : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};
