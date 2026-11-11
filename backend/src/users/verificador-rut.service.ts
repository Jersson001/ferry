import { Injectable, Logger } from '@nestjs/common';
import { verificarRut, VerificacionRut } from './rut';

// Envoltura inyectable de verificarRut para poder reemplazarla en las pruebas sin salir a la red.
@Injectable()
export class VerificadorRutService {
  private readonly logger = new Logger(VerificadorRutService.name);

  async verificar(texto: string): Promise<VerificacionRut> {
    const resultado = await verificarRut(texto, fetch as any, { appToken: process.env.RUES_APP_TOKEN });
    if (resultado.estado === 'SIN_CONSULTA') this.logger.warn(`No se pudo consultar el RUES para ${resultado.nit}`);
    return resultado;
  }
}

// Cuánto vale una verificación positiva antes de volver a consultar el RUES al guardar el perfil.
export const VIGENCIA_VERIFICACION_MS = 30 * 24 * 60 * 60 * 1000;

// Resultados que no cambian si se repite la consulta con el mismo texto.
const DEFINITIVOS = ['FORMATO_INVALIDO', 'DV_INVALIDO'];

// Qué hacer con el RUT que llega en el perfil. Se vuelve a consultar el RUES si el RUT cambió, si no
// quedó verificado (pudo renovar la matrícula o el RUES estaba caído) o si la verificación tiene más de
// 30 días. Devuelve los campos a guardar.
export async function camposDeRut(
  rutNuevo: string,
  actual: { rut?: string | null; rutVerificacion?: VerificacionRut | null } | null,
  verificador: Pick<VerificadorRutService, 'verificar'>,
  ahora: Date = new Date(),
): Promise<{ rut: string | null; rutVerificacion: VerificacionRut | null }> {
  const texto = rutNuevo.trim();
  if (!texto) return { rut: null, rutVerificacion: null };

  const previa = actual?.rutVerificacion;
  const igual = !!actual?.rut && (actual.rut === texto || previa?.nit === texto);
  const vigente = !!previa && (DEFINITIVOS.includes(previa.estado)
    || (previa.estado === 'VERIFICADO' && ahora.getTime() - new Date(previa.verificadoEn).getTime() < VIGENCIA_VERIFICACION_MS));
  if (igual && vigente) return { rut: actual!.rut!, rutVerificacion: previa! };

  const rutVerificacion = await verificador.verificar(texto);
  const conFormato = rutVerificacion.estado !== 'FORMATO_INVALIDO' && rutVerificacion.estado !== 'DV_INVALIDO';
  return { rut: conFormato && rutVerificacion.nit ? rutVerificacion.nit : texto, rutVerificacion };
}
