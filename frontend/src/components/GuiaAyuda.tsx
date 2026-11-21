import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag, Inbox, Briefcase, HardHat, Bell, Truck, Package,
  X, ChevronLeft, ChevronRight, HelpCircle, Hand, CheckCircle2,
} from 'lucide-react';

// Guías por tarea en una ventana flotante. El usuario usa la app normal: la guía resalta el botón real
// (marcado con data-tour="…") y dice qué hacer. En los pasos de "tocar", avanza sola cuando el usuario
// toca el botón resaltado; en los de "leer", con Siguiente. Si el botón no está en pantalla, la ventana
// explica por qué (p. ej. todavía no hay solicitudes) y deja seguir.

export type RolAyuda = 'cliente' | 'ferreteria';

interface Paso {
  objetivo?: string | string[]; // data-tour de los botones a resaltar (se resaltan juntos)
  accion: 'tocar' | 'leer';
  texto: string; // **así** va en negrilla
  siNoEsta?: string; // qué decir si el botón no aparece
}

export interface Guia {
  id: string;
  titulo: string;
  descripcion: string;
  icono: React.ElementType;
  pasos: Paso[];
}

export const GUIAS: Record<RolAyuda, Guia[]> = {
  cliente: [
    {
      id: 'materiales', titulo: 'Cotizar materiales', descripcion: 'Pide precios a las ferreterías cercanas', icono: ShoppingBag,
      pasos: [
        { objetivo: 'nav-SHOP', accion: 'tocar', texto: 'Toca **Materiales** en la barra de abajo.' },
        { objetivo: 'direccion', accion: 'leer', texto: 'Escribe la **dirección de la obra** y elige una de las sugerencias. Así te cotizan las ferreterías que están cerca.' },
        { objetivo: ['subir-lista', 'escribir-lista', 'crear-manual'], accion: 'tocar', texto: 'Elige cómo armar tu lista: **Sube tu Lista** (una foto, imagen o PDF), **Escribir Lista** o **Crear Manualmente**.' },
        {
          objetivo: ['procesar-texto', 'enviar-solicitud'], accion: 'leer',
          texto: 'Si la escribiste, toca **Procesar**. Luego revisa los materiales y las cantidades, elige la especialidad y toca **Cotizar con expertos**.',
          siNoEsta: 'Cuando aparezca tu lista, revisa los materiales y las cantidades, elige la especialidad y envíala.',
        },
        { accion: 'leer', texto: '¡Listo! Las ferreterías te responden en **Cotizaciones → Recibidas**, hasta 5 por solicitud. Te avisamos cuando llegue una.' },
      ],
    },
    {
      id: 'pagar', titulo: 'Ver y pagar cotizaciones', descripcion: 'Compara precios y paga con Nequi o tarjeta', icono: Inbox,
      pasos: [
        { objetivo: 'nav-QUOTES', accion: 'tocar', texto: 'Toca **Cotizaciones** en la barra de abajo.' },
        { objetivo: 'tab-recibidas', accion: 'tocar', texto: 'Abre **Recibidas**: aquí llegan las respuestas de las ferreterías.' },
        {
          objetivo: 'pagar-cotizacion', accion: 'tocar', texto: 'Compara el precio y el envío. Cuando elijas una, toca **Pagar**.',
          siNoEsta: 'Todavía no tienes cotizaciones. Cuando una ferretería responda, aparecerá aquí con el botón Pagar.',
        },
        {
          objetivo: 'metodo-nequi', accion: 'leer',
          texto: 'Elige **Nequi**, escribe tu celular y acepta la notificación en la app Nequi. El pago se confirma solo y la ferretería empieza a alistar tu pedido.',
          siNoEsta: 'Al pagar, elige Nequi y acepta la notificación en tu app, o paga con tarjeta o PSE. El pago se confirma solo.',
        },
      ],
    },
    {
      id: 'publicar', titulo: 'Publicar un proyecto', descripcion: 'Contrata mano de obra para tu obra', icono: Briefcase,
      pasos: [
        { objetivo: 'nav-HUB', accion: 'tocar', texto: 'Toca **Proyectos** en la barra de abajo.' },
        { objetivo: 'modo-cliente', accion: 'tocar', texto: 'Elige **Busco Profesional**.' },
        { objetivo: 'publicar-proyecto', accion: 'tocar', texto: 'Toca **Publicar Solicitud**.' },
        { objetivo: 'form-proyecto', accion: 'leer', texto: 'Llena el **título**, la **categoría**, la **ciudad**, la descripción y tu presupuesto. Entre más claro, mejores ofertas.' },
        { objetivo: 'boton-publicar', accion: 'tocar', texto: 'Elige el tipo de publicación y toca **Publicar**.' },
        { accion: 'leer', texto: '¡Publicado! Los profesionales se postulan y los ves en **Mis Proyectos Activos**. Toca tu proyecto para ver los candidatos y aceptar uno.' },
      ],
    },
    {
      id: 'postular', titulo: 'Postularme a un proyecto', descripcion: 'Si eres contratista o profesional', icono: HardHat,
      pasos: [
        { objetivo: 'nav-HUB', accion: 'tocar', texto: 'Toca **Proyectos** en la barra de abajo.' },
        { objetivo: 'modo-trabajo', accion: 'tocar', texto: 'Elige **Busco Trabajo**.' },
        { objetivo: 'tab-oportunidades', accion: 'tocar', texto: 'Abre **Oportunidades**: los proyectos que publicaron los clientes.' },
        {
          objetivo: 'postularme', accion: 'tocar', texto: 'Elige un proyecto y toca **Postularme**.',
          siNoEsta: 'Ahora no hay proyectos abiertos de tu interés. Vuelve pronto: aparecen aquí.',
        },
        {
          objetivo: 'enviar-postulacion', accion: 'leer',
          texto: 'Escribe tu **precio** y tu **propuesta**, y envíala. Si el cliente te acepta, verás su contacto en **Mis postulaciones**.',
          siNoEsta: 'Escribe tu precio y tu propuesta, y envíala. Si te piden un plan, revisa las opciones para postularte.',
        },
      ],
    },
  ],
  ferreteria: [
    {
      id: 'pedidos', titulo: 'Ver cuando llega un pedido', descripcion: 'Recibe solicitudes y cotiza primero', icono: Bell,
      pasos: [
        {
          objetivo: 'avisos', accion: 'leer', texto: 'Toca **Activar** para recibir un aviso apenas un cliente de tu zona pida materiales.',
          siNoEsta: 'Este navegador no permite avisos. Revisa tu Panel seguido para no perder solicitudes.',
        },
        { objetivo: 'tab-nuevas', accion: 'tocar', texto: 'Las solicitudes llegan a **Nuevas**. El número rojo te dice cuántas hay sin responder.' },
        {
          objetivo: 'ver-cotizar', accion: 'tocar', texto: 'Toca **Ver y Cotizar** en una solicitud.',
          siNoEsta: 'Ahora no tienes solicitudes nuevas. Cuando llegue una, aparecerá aquí con el botón Ver y Cotizar.',
        },
        {
          objetivo: 'enviar-cotizacion', accion: 'leer',
          texto: 'Marca lo que tienes, pon tu precio y el costo del envío, y toca **Enviar Cotización**. Cada solicitud recibe máximo 5: gana quien responde primero.',
          siNoEsta: 'Al cotizar, marca lo que tienes, pon tu precio y el envío, y toca Enviar Cotización.',
        },
      ],
    },
    {
      id: 'despachar', titulo: 'Despachar un pedido pagado', descripcion: 'Qué hacer cuando el cliente paga', icono: Truck,
      pasos: [
        { objetivo: 'tab-cerradas', accion: 'tocar', texto: 'Abre **Cerradas**: aquí están los pedidos que el cliente ya pagó.' },
        {
          objetivo: 'marcar-enviado', accion: 'leer',
          texto: 'Si dice **Pago en revisión**, espera. En **Alistando** ya puedes ver al cliente: prepara el pedido y toca **Marcar como En Camino** al despacharlo.',
          siNoEsta: 'Ahora no tienes pedidos por despachar. Cuando un cliente pague, te llega el aviso "¡Pedido pagado!" y el pedido aparece aquí.',
        },
      ],
    },
    {
      id: 'catalogo', titulo: 'Subir mi catálogo', descripcion: 'Productos, ofertas y tu QR', icono: Package,
      pasos: [
        { objetivo: 'nav-CATALOG', accion: 'tocar', texto: 'Toca **Catálogo** en la barra de abajo.' },
        {
          objetivo: 'agregar-producto', accion: 'tocar', texto: 'Toca **Agregar** para subir un producto con precio y existencias. Para subir muchos, usa **Excel/CSV**.',
          siNoEsta: 'Usa la pestaña Manual para subir un producto, o Excel/CSV para subir muchos.',
        },
        { accion: 'leer', texto: 'Marca **Producto en oferta** para que salga en el inicio de los clientes cercanos.' },
        { objetivo: 'compartir-catalogo', accion: 'leer', texto: 'Con este botón compartes tu catálogo con un **QR** o por WhatsApp.' },
      ],
    },
  ],
};

// ── Primera vez: la ventana de guías se abre sola una vez por cuenta ───────────────────────────────
const clave = (uid: string) => `ferry_ayuda_bienvenida_${uid}`;
export const bienvenidaVista = (uid: string): boolean => {
  try { return localStorage.getItem(clave(uid)) === '1'; } catch { return true; }
};
export const marcarBienvenidaVista = (uid: string) => {
  try { localStorage.setItem(clave(uid), '1'); } catch { /* sin almacenamiento: se verá otra vez */ }
};

const Negrillas: React.FC<{ texto: string }> = ({ texto }) => (
  <>{texto.split('**').map((parte, i) => (i % 2 ? <strong key={i} className="text-slate-900">{parte}</strong> : parte))}</>
);

const elementos = (objetivo?: string | string[]): HTMLElement[] =>
  (Array.isArray(objetivo) ? objetivo : objetivo ? [objetivo] : [])
    .flatMap(o => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${o}"]`);
      return el && el.getBoundingClientRect().width > 0 ? [el] : [];
    });

// ── Ventana con la lista de guías ───────────────────────────────────────────────────────────────────
export const CentroAyuda: React.FC<{
  rol: RolAyuda;
  bienvenida: boolean;
  onElegir: (guia: Guia) => void;
  onCerrar: () => void;
}> = ({ rol, bienvenida, onElegir, onCerrar }) => (
  <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Guías de Ferry">
    <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
    <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom-10 duration-300">
      <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-lg font-black text-slate-900">
          {bienvenida ? '¡Bienvenido a Ferry! 👋' : '¿En qué te ayudamos?'}
        </h2>
        <button onClick={onCerrar} aria-label="Cerrar" className="p-1 -mr-1 text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {bienvenida ? 'Elige qué quieres hacer y te guiamos paso a paso, en la app de verdad.' : 'Elige una tarea y te guiamos paso a paso.'}
      </p>
      <ul className="space-y-2">
        {GUIAS[rol].map(g => {
          const Icono = g.icono;
          return (
            <li key={g.id}>
              <button
                onClick={() => onElegir(g)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-ferry-300 hover:bg-ferry-50 text-left transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-ferry-100 text-ferry-600 flex items-center justify-center shrink-0">
                  <Icono className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm text-slate-800">{g.titulo}</span>
                  <span className="block text-xs text-slate-500">{g.descripcion}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-slate-400 text-center mt-4 flex items-center justify-center gap-1">
        <HelpCircle className="w-3.5 h-3.5" /> Vuelve a abrir esta ayuda con el botón ? de arriba.
      </p>
    </div>
  </div>
);

// ── Ventana flotante que acompaña una guía ──────────────────────────────────────────────────────────
export const GuiaFlotante: React.FC<{ guia: Guia; onTerminar: () => void }> = ({ guia, onTerminar }) => {
  const [paso, setPaso] = useState(0);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [noEsta, setNoEsta] = useState(false);
  const actual = guia.pasos[paso];
  const ultimo = paso === guia.pasos.length - 1;
  const desplazado = useRef(false);
  const tarjeta = useRef<HTMLDivElement>(null);

  // Busca y mide los botones del paso cada 300 ms: la app cambia de pantalla, abre ventanas y se desplaza
  useEffect(() => {
    desplazado.current = false;
    setNoEsta(false);
    setCaja(null);
    if (!actual.objetivo) return;
    const inicio = Date.now();
    const medir = () => {
      const els = elementos(actual.objetivo);
      if (els.length === 0) {
        setCaja(null);
        if (Date.now() - inicio > 2500) setNoEsta(true);
        return;
      }
      setNoEsta(false);
      if (!desplazado.current) {
        const r = els[0].getBoundingClientRect();
        // Algo más alto que media pantalla (un formulario) se muestra desde su comienzo
        const alto = r.height > window.innerHeight * 0.5;
        if (r.top < 70 || r.bottom > window.innerHeight - 200) els[0].scrollIntoView({ block: alto ? 'start' : 'center' });
        desplazado.current = true;
      }
      const rs = els.map(e => e.getBoundingClientRect());
      const top = Math.min(...rs.map(r => r.top)), left = Math.min(...rs.map(r => r.left));
      const bottom = Math.max(...rs.map(r => r.bottom)), right = Math.max(...rs.map(r => r.right));
      setCaja({ top, left, width: right - left, height: bottom - top });
    };
    medir();
    const id = setInterval(medir, 300);
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      clearInterval(id);
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [paso, actual.objetivo]);

  // En los pasos de "tocar", avanzar cuando el usuario toca el botón resaltado (la app hace lo suyo igual)
  useEffect(() => {
    if (actual.accion !== 'tocar' || !actual.objetivo) return;
    const alTocar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tarjeta.current?.contains(t)) return;
      if (elementos(actual.objetivo).some(el => el.contains(t))) {
        setTimeout(() => (ultimo ? onTerminar() : setPaso(p => p + 1)), 150);
      }
    };
    document.addEventListener('click', alTocar, true);
    return () => document.removeEventListener('click', alTocar, true);
  }, [paso, actual, ultimo, onTerminar]);

  // La ventana va arriba si el botón está en la mitad de abajo, y abajo si está arriba. Con algo más alto
  // que media pantalla (un formulario), abajo, para no tapar sus primeros campos.
  const arriba = caja && caja.height <= window.innerHeight * 0.5
    ? caja.top + caja.height / 2 > window.innerHeight / 2
    : false;
  const esperandoToque = actual.accion === 'tocar' && !!caja;
  const RELLENO = 5;

  return (
    <>
      {caja && (
        <div
          className="fixed z-[65] pointer-events-none rounded-2xl ring-4 ring-ferry-500 shadow-[0_0_0_6px_rgba(249,115,22,0.25)] animate-pulse transition-all duration-200"
          style={{ top: caja.top - RELLENO, left: caja.left - RELLENO, width: caja.width + RELLENO * 2, height: caja.height + RELLENO * 2 }}
        />
      )}
      {esperandoToque && (
        <div
          className="fixed z-[66] pointer-events-none flex items-center gap-1 bg-ferry-600 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow-lg animate-bounce"
          style={
            caja!.top > 40
              ? { top: caja!.top - RELLENO - 30, left: Math.max(8, Math.min(caja!.left + caja!.width / 2 - 40, window.innerWidth - 96)) }
              : { top: caja!.top + caja!.height + RELLENO + 6, left: Math.max(8, Math.min(caja!.left + caja!.width / 2 - 40, window.innerWidth - 96)) }
          }
        >
          <Hand className="w-3.5 h-3.5" /> Toca aquí
        </div>
      )}

      <div
        ref={tarjeta}
        role="dialog"
        aria-label={`Guía: ${guia.titulo}`}
        className={`fixed z-[70] left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[380px] bg-white rounded-2xl shadow-2xl border border-ferry-100 p-4 ${arriba ? 'top-3' : 'bottom-[84px]'}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-ferry-600 truncate">
            {guia.titulo} · Paso {paso + 1} de {guia.pasos.length}
          </span>
          <button onClick={onTerminar} className="text-xs font-semibold text-slate-400 hover:text-slate-700 shrink-0">
            Salir
          </button>
        </div>
        <div className="flex gap-1 mb-3">
          {guia.pasos.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= paso ? 'bg-ferry-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <p key={paso} className="text-sm text-slate-700 leading-relaxed animate-in fade-in duration-200">
          <Negrillas texto={noEsta && actual.siNoEsta ? actual.siNoEsta : actual.texto} />
        </p>
        {actual.objetivo && !caja && !noEsta && (
          <p className="text-[11px] text-slate-400 mt-1">Buscando el botón en la pantalla…</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          {paso > 0 && (
            <button
              onClick={() => setPaso(p => p - 1)}
              aria-label="Paso anterior"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {esperandoToque ? (
            <p className="flex-1 text-xs font-semibold text-ferry-700 bg-ferry-50 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
              <Hand className="w-4 h-4 shrink-0" /> Toca el botón resaltado para seguir
            </p>
          ) : (
            <button
              onClick={() => (ultimo ? onTerminar() : setPaso(p => p + 1))}
              className="flex-1 h-10 rounded-xl bg-ferry-500 hover:bg-ferry-600 text-white text-sm font-bold flex items-center justify-center gap-1"
            >
              {ultimo ? <><CheckCircle2 className="w-4 h-4" /> Entendido</> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
