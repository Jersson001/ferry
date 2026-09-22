import { Logger } from '@nestjs/common';

export interface GeminiRetryOptions {
  /** Intentos en total, contando el primero. */
  maxAttempts?: number;
  /** Espera máxima aceptable antes de un reintento. Si Google pide más, no se reintenta. */
  maxWaitMs?: number;
  logger?: Logger;
  /** Inyectable para las pruebas. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Cuánto esperar antes de reintentar una llamada a Gemini que falló, o
 * `null` si el error no es pasajero y reintentar no serviría.
 *
 * - 500 y 503 (sobrecarga, "high demand"): pasajeros. Espera creciente.
 * - 429: solo si Google indica cuánto esperar ("Please retry in 3.2s") y
 *   es poco. Así se reintenta un límite por minuto, pero no la cuota
 *   diaria (pide ~24 s y se agota igual) ni el saldo de prepago agotado
 *   (no trae indicación).
 * - Cualquier otro (clave inválida, permisos, modelo retirado): nunca.
 */
export function retryDelayMs(error: any, attempt: number, maxWaitMs: number): number | null {
  const status: number | undefined = error?.status;
  const message = String(error?.message ?? '');
  const hint = /retry in ([\d.]+)\s*s/i.exec(message);
  const hintedMs = hint ? Math.ceil(parseFloat(hint[1]) * 1000) : null;

  let waitMs: number;
  if (status === 500 || status === 503) {
    // 1 s, 2 s, 4 s… con un poco de azar para no reintentar todos a la vez.
    waitMs = hintedMs ?? 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
  } else if (status === 429 && hintedMs !== null) {
    waitMs = hintedMs;
  } else {
    return null;
  }

  return waitMs <= maxWaitMs ? waitMs : null;
}

/**
 * Ejecuta `call` y la reintenta ante fallos pasajeros de Gemini. Si el error
 * no es pasajero, o se agotan los intentos, relanza el último error tal cual
 * para que el llamador lo traduzca a una respuesta HTTP.
 */
export async function withGeminiRetry<T>(
  call: () => Promise<T>,
  { maxAttempts = 3, maxWaitMs = 8000, logger, sleep = defaultSleep }: GeminiRetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error: any) {
      const waitMs = attempt < maxAttempts ? retryDelayMs(error, attempt, maxWaitMs) : null;
      if (waitMs === null) throw error;
      logger?.warn(
        `Gemini respondió ${error?.status ?? '?'} (intento ${attempt} de ${maxAttempts}); reintento en ${waitMs} ms`,
      );
      await sleep(waitMs);
    }
  }
}
