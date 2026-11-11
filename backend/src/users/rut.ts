// Verificación del RUT (NIT) de un negocio colombiano.
//
// Dos niveles:
//  1. Sin red: formato y dígito de verificación (DV) con el algoritmo de módulo 11 de la DIAN.
//  2. Con red: el Registro Único Empresarial (RUES) que Confecámaras publica como datos abiertos en
//     datos.gov.co (conjunto c82u-588k). Dice si el NIT tiene matrícula mercantil, su razón social y si
//     está activa. La consulta de estado del RUT de la DIAN (Muisca) tiene captcha y no tiene API pública,
//     así que no se usa.
//
// La skill `verificar-rut` de Claude Code (.claude/skills/verificar-rut) repite el cálculo del DV en un
// script independiente; rut.paridad.spec.ts comprueba que los dos den lo mismo.

const PESOS_DIAN = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export const RUES_URL = 'https://www.datos.gov.co/resource/c82u-588k.json';

// Actividades CIIU de una ferretería: comercio al por menor (4752) y al por mayor (4663) de artículos de
// ferretería y materiales de construcción.
export const CIIU_FERRETERIA = ['4752', '4663'];

/** Dígito de verificación de la DIAN para un número de NIT o cédula (solo dígitos, sin el DV). */
export function calcularDV(numero: string): number {
  if (!/^\d{1,15}$/.test(numero)) throw new Error('El número debe tener solo dígitos.');
  let suma = 0;
  const digitos = numero.split('').reverse();
  digitos.forEach((d, i) => { suma += Number(d) * PESOS_DIAN[i]; });
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

export interface RutLeido {
  numero: string; // Sin puntos, espacios ni DV
  dv?: number; // Solo si quien lo escribió lo separó con guion
}

/**
 * Lee un RUT como lo escribe la gente: "890.903.938-8", "NIT 890903938 - 8", "890903938".
 * El DV solo se toma si viene después de un guion; sin guion, todos los dígitos son el número
 * (una cédula de 10 dígitos no se puede distinguir de un NIT de 9 con su DV pegado).
 */
export function leerRut(texto: string): RutLeido | null {
  const limpio = texto.toUpperCase().replace(/NIT|RUT|[\s.,]/g, '');
  const m = /^(\d+)(?:-(\d))?$/.exec(limpio);
  if (!m) return null;
  const numero = m[1].replace(/^0+/, '');
  if (numero.length < 5 || numero.length > 10) return null;
  return { numero, dv: m[2] === undefined ? undefined : Number(m[2]) };
}

export type EstadoRut =
  | 'VERIFICADO' // DV correcto y matrícula activa en el RUES
  | 'FORMATO_INVALIDO'
  | 'DV_INVALIDO'
  | 'NO_REGISTRADO' // DV correcto, pero el RUES no tiene matrícula con ese número
  | 'MATRICULA_INACTIVA' // Está en el RUES, pero cancelada o en liquidación
  | 'SIN_RENOVAR' // Activa, pero sin renovar el año en curso ni el anterior
  | 'SIN_CONSULTA'; // No se pudo consultar el RUES; se reintenta después

export interface VerificacionRut {
  estado: EstadoRut;
  mensaje: string;
  nit?: string; // "890903938-8"
  razonSocial?: string;
  estadoMatricula?: string;
  camara?: string;
  ultimoAnoRenovado?: number;
  ciiu?: string[];
  actividadFerreteria?: boolean;
  verificadoEn: string; // ISO
}

/** Lo que se puede decir sin red. Si el formato y el DV están bien, devuelve lo leído para consultar el RUES. */
export function validarSinRed(texto: string, ahora = new Date()): VerificacionRut | { leido: RutLeido; dv: number } {
  const verificadoEn = ahora.toISOString();
  const leido = leerRut(texto);
  if (!leido) {
    return { estado: 'FORMATO_INVALIDO', verificadoEn,
      mensaje: 'El RUT debe ser el número de NIT (5 a 10 dígitos) con su dígito de verificación, por ejemplo 900123456-7.' };
  }
  const dv = calcularDV(leido.numero);
  if (leido.dv !== undefined && leido.dv !== dv) {
    return { estado: 'DV_INVALIDO', verificadoEn, nit: `${leido.numero}-${leido.dv}`,
      mensaje: `El dígito de verificación no corresponde: para ${leido.numero} debería ser ${dv}. Revisa el número en tu RUT.` };
  }
  return { leido, dv };
}

export interface FilaRues {
  razon_social?: string;
  numero_identificacion?: string;
  nit?: string;
  digito_verificacion?: string;
  estado_matricula?: string;
  camara_comercio?: string;
  ultimo_ano_renovado?: string;
  categoria_matricula?: string;
  cod_ciiu_act_econ_pri?: string;
  cod_ciiu_act_econ_sec?: string;
  ciiu3?: string;
  ciiu4?: string;
}

type Fetch = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Matrículas del RUES cuyo número de identificación es alguno de `numeros`. Para una sociedad es su NIT y
 * para una persona natural su cédula (que es también su NIT). No se busca por la columna `nit`: en filas
 * de personas naturales trae valores ajenos (hay comerciantes con el NIT de la DIAN ahí).
 */
export async function consultarRues(numeros: string[], fetchFn: Fetch, timeoutMs = 8000, appToken?: string): Promise<FilaRues[]> {
  const lista = numeros.map(n => `'${n.replace(/\D/g, '')}'`).join(',');
  const where = `numero_identificacion in(${lista})`;
  const url = `${RUES_URL}?$limit=50&$where=${encodeURIComponent(where)}`;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: control.signal, headers: appToken ? { 'X-App-Token': appToken } : {} });
    if (!res.ok) throw new Error(`RUES respondió ${res.status}`);
    const filas = await res.json();
    return Array.isArray(filas) ? (filas as FilaRues[]) : [];
  } finally {
    clearTimeout(reloj);
  }
}

const esActiva = (f: FilaRues) => (f.estado_matricula ?? '').toUpperCase() === 'ACTIVA';
const esEstablecimiento = (f: FilaRues) => (f.categoria_matricula ?? '').toUpperCase().includes('ESTABLECIMIENTO');

/** La matrícula que representa al negocio: activa antes que cancelada, la principal antes que un establecimiento, la más renovada. */
export function elegirMatricula(filas: FilaRues[]): FilaRues | undefined {
  return [...filas].sort((a, b) =>
    Number(esActiva(b)) - Number(esActiva(a))
    || Number(esEstablecimiento(a)) - Number(esEstablecimiento(b))
    || Number(b.ultimo_ano_renovado ?? 0) - Number(a.ultimo_ano_renovado ?? 0))[0];
}

// La matrícula se renueva cada año antes del 31 de marzo; se acepta la del año anterior para no castigar
// a nadie entre enero y marzo.
export function renovadaAlDia(ultimoAnoRenovado: number | undefined, ahora: Date): boolean {
  return !!ultimoAnoRenovado && ultimoAnoRenovado >= ahora.getUTCFullYear() - 1;
}

/** Verificación completa: formato, DV y matrícula activa y renovada en el RUES. Nunca lanza: si el RUES falla, devuelve SIN_CONSULTA. */
export async function verificarRut(texto: string, fetchFn: Fetch, opciones: { ahora?: Date; timeoutMs?: number; appToken?: string } = {}): Promise<VerificacionRut> {
  const ahora = opciones.ahora ?? new Date();
  const sinRed = validarSinRed(texto, ahora);
  if ('estado' in sinRed) return sinRed;

  const { leido, dv } = sinRed;
  const nit = `${leido.numero}-${dv}`;
  const verificadoEn = ahora.toISOString();

  // Sin guion, el último dígito podría ser el DV pegado: también se busca el número sin él.
  const candidatos = [leido.numero];
  const sinUltimo = leido.numero.slice(0, -1);
  if (leido.dv === undefined && sinUltimo.length >= 5 && calcularDV(sinUltimo) === Number(leido.numero.slice(-1))) {
    candidatos.push(sinUltimo);
  }

  let filas: FilaRues[];
  try {
    filas = await consultarRues(candidatos, fetchFn, opciones.timeoutMs, opciones.appToken);
  } catch {
    return { estado: 'SIN_CONSULTA', nit, verificadoEn,
      mensaje: 'El DV es correcto, pero no pudimos consultar el registro mercantil (RUES). Lo intentaremos de nuevo.' };
  }

  // Si el número completo no aparece y sí el que no tiene el último dígito, era un NIT con su DV pegado.
  const exactas = filas.filter(f => f.numero_identificacion === leido.numero);
  const usadas = exactas.length ? exactas : filas;
  const numeroFinal = exactas.length || filas.length === 0 ? leido.numero : sinUltimo;
  const nitFinal = `${numeroFinal}-${calcularDV(numeroFinal)}`;

  const fila = elegirMatricula(usadas);
  if (!fila) {
    return { estado: 'NO_REGISTRADO', nit, verificadoEn,
      mensaje: 'El DV es correcto, pero no encontramos una matrícula mercantil con ese NIT en el RUES. Revisa el número o escríbenos.' };
  }

  const ciiu = [fila.cod_ciiu_act_econ_pri, fila.cod_ciiu_act_econ_sec, fila.ciiu3, fila.ciiu4]
    .filter((c): c is string => !!c && c !== '0' && c !== '9999');
  const datos = {
    nit: nitFinal,
    razonSocial: fila.razon_social?.trim(),
    estadoMatricula: fila.estado_matricula,
    camara: fila.camara_comercio,
    ultimoAnoRenovado: fila.ultimo_ano_renovado ? Number(fila.ultimo_ano_renovado) : undefined,
    ciiu,
    actividadFerreteria: ciiu.some(c => CIIU_FERRETERIA.includes(c)),
    verificadoEn,
  };

  if (!esActiva(fila)) {
    return { estado: 'MATRICULA_INACTIVA', ...datos,
      mensaje: `La matrícula mercantil de ${datos.razonSocial ?? 'ese NIT'} figura como ${(fila.estado_matricula ?? 'inactiva').toLowerCase()} en el RUES.` };
  }
  // El RUES deja "ACTIVA" a sociedades disueltas o abandonadas: se mira también la razón social y la renovación.
  if (/EN\s+LIQUIDACI[OÓ]N/i.test(datos.razonSocial ?? '')) {
    return { estado: 'MATRICULA_INACTIVA', ...datos, mensaje: `${datos.razonSocial} figura en liquidación en el RUES.` };
  }
  if (!renovadaAlDia(datos.ultimoAnoRenovado, ahora)) {
    return { estado: 'SIN_RENOVAR', ...datos,
      mensaje: `La matrícula de ${datos.razonSocial ?? 'ese NIT'} se renovó por última vez en ${datos.ultimoAnoRenovado || 'un año desconocido'}. Renuévala en tu Cámara de Comercio y vuelve a guardar el RUT.` };
  }
  return { estado: 'VERIFICADO', ...datos, mensaje: `RUT verificado: ${datos.razonSocial} (${nitFinal}), matrícula activa.` };
}
