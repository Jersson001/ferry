// Revisión del RUT en el navegador: formato y dígito de verificación (módulo 11 de la DIAN), para avisar
// antes de guardar. La verificación de verdad (matrícula en el RUES) la hace el backend.

const PESOS_DIAN = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function calcularDV(numero: string): number {
  let suma = 0;
  numero.split('').reverse().forEach((d, i) => { suma += Number(d) * PESOS_DIAN[i]; });
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

/** `null` si se puede guardar (o está vacío); si no, el error para mostrar. */
export function errorDeRut(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/NIT|RUT|[\s.,]/g, '');
  if (!limpio) return null;
  const m = /^(\d+)(?:-(\d))?$/.exec(limpio);
  const numero = m?.[1].replace(/^0+/, '') ?? '';
  if (!m || numero.length < 5 || numero.length > 10) return 'Escribe el NIT con su dígito de verificación, por ejemplo 900123456-7.';
  if (m[2] !== undefined && Number(m[2]) !== calcularDV(numero)) {
    return `El dígito de verificación no corresponde: para ${numero} debería ser ${calcularDV(numero)}.`;
  }
  return null;
}

export type EstadoRut = 'VERIFICADO' | 'FORMATO_INVALIDO' | 'DV_INVALIDO' | 'NO_REGISTRADO' | 'MATRICULA_INACTIVA' | 'SIN_RENOVAR' | 'SIN_CONSULTA';

export interface VerificacionRut {
  estado: EstadoRut;
  mensaje: string;
  nit?: string;
  razonSocial?: string;
  estadoMatricula?: string;
  camara?: string;
  ultimoAnoRenovado?: number;
  actividadFerreteria?: boolean;
  verificadoEn: string;
}

export const ETIQUETA_RUT: Record<EstadoRut, string> = {
  VERIFICADO: 'RUT verificado',
  FORMATO_INVALIDO: 'RUT con formato inválido',
  DV_INVALIDO: 'Dígito de verificación incorrecto',
  NO_REGISTRADO: 'Sin matrícula en el RUES',
  MATRICULA_INACTIVA: 'Matrícula inactiva',
  SIN_RENOVAR: 'Matrícula sin renovar',
  SIN_CONSULTA: 'Verificación pendiente',
};
