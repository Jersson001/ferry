import React from 'react';

// Fachada de una tienda (toldo + local) con el contorno del color de la especialidad y su ícono adentro.
// Sirve para que el usuario entienda que lo que elige es una tienda, no una categoría abstracta.
// El color sale de la clase de texto (p. ej. "text-blue-500"): el dibujo usa currentColor.

const ONDAS = 'M2 15c0 2.5 2 4 5.5 4S13 17.5 13 15c0 2.5 2 4 5.5 4S24 17.5 24 15c0 2.5 2 4 5.5 4S35 17.5 35 15c0 2.5 2 4 5.5 4S46 17.5 46 15Z';

export const IconoTienda: React.FC<{
  icono: React.ElementType;
  color: string; // clase de color de texto de Tailwind
  tamano?: number; // ancho en px
  seleccionada?: boolean;
}> = ({ icono: Icono, color, tamano = 48, seleccionada = false }) => (
  <span className={`relative inline-block ${color}`} style={{ width: tamano, height: tamano * 0.92 }}>
    <svg viewBox="0 0 48 44" className="absolute inset-0 w-full h-full" fill="none" aria-hidden="true">
      {/* Local */}
      <rect x="6" y="17" width="36" height="24" rx="2" fill="currentColor" fillOpacity={seleccionada ? 0.22 : 0.1} stroke="currentColor" strokeWidth="2" />
      {/* Toldo con franjas */}
      <path d="M8 4h32l6 11H2L8 4Z" fill="currentColor" fillOpacity={seleccionada ? 0.4 : 0.22} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16.5 4 13 15M24 4v11M31.5 4 35 15" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55" />
      {/* Borde ondulado del toldo: primero blanco para tapar la línea del local, luego el color */}
      <path d={ONDAS} fill="white" />
      <path d={ONDAS} fill="currentColor" fillOpacity={seleccionada ? 0.4 : 0.22} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
    {/* Ícono de la especialidad, en la fachada */}
    <span className="absolute left-0 right-0 flex justify-center" style={{ top: tamano * 0.44 }}>
      <Icono style={{ width: tamano * 0.36, height: tamano * 0.36 }} strokeWidth={2.2} />
    </span>
  </span>
);
