export const DIAS_PARA_RECLAMAR = 7;

// Sin 0/O ni 1/I/L: un código que se dicta por teléfono o se lee en un cartel no debe confundirse.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_GENERADO = 6;

const FORMATO = /^[A-Z0-9]{3,20}$/;

export function normalizarCodigo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const c = valor.trim().toUpperCase();
  return FORMATO.test(c) ? c : null;
}

export function generarCodigo(aleatorio: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < LARGO_GENERADO; i++) c += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return c;
}

export function limpiarNombre(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const n = valor.trim().replace(/\s+/g, ' ').slice(0, 60);
  return n === '' ? null : n;
}

// Un código se reclama al terminar de registrarse, no el día que le convenga a quien ya lleva meses:
// sin este plazo, cualquiera podría atribuirse a un código para favorecer a alguien.
export function estaEnPlazo(cuentaCreada: Date, ahora: Date = new Date()): boolean {
  const ms = ahora.getTime() - new Date(cuentaCreada).getTime();
  return ms >= 0 && ms <= DIAS_PARA_RECLAMAR * 24 * 60 * 60 * 1000;
}
