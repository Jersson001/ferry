import { HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

// Errores con el texto exacto que devolvió Gemini en producción.
const fetchError = (status: number, text: string) =>
  Object.assign(new Error(`[GoogleGenerativeAI Error]: Error fetching from ...: ${text}`), { status });

/** Estado HTTP con que handleGeminiError traduce un error de Gemini. */
function translatedStatus(error: unknown): number {
  const service = new AiService({ get: () => undefined } as any);
  try {
    (service as any).handleGeminiError(error, 'mensaje por defecto');
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  throw new Error('handleGeminiError debía lanzar');
}

describe('AiService.handleGeminiError', () => {
  it('saldo de prepago agotado (402, como llega hoy) → 503, para ofrecer la captura manual', () => {
    const e = fetchError(402, '[402 Payment Required] Your prepayment credits are depleted. Please go to AI Studio.');
    expect(translatedStatus(e)).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('saldo de prepago agotado (429, como llegaba antes) → 503, no "intenta en unos minutos"', () => {
    const e = fetchError(429, '[429 Too Many Requests] Your prepayment credits are depleted. Please go to AI Studio.');
    expect(translatedStatus(e)).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('cuota del nivel gratuito → 429', () => {
    const e = fetchError(
      429,
      '[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generate_content_free_tier_requests, limit: 20.',
    );
    expect(translatedStatus(e)).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('sobrecarga del modelo (503) → 429, para que el usuario reintente', () => {
    const e = fetchError(503, '[503 Service Unavailable] This model is currently experiencing high demand.');
    expect(translatedStatus(e)).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('proyecto bloqueado (403) → 503', () => {
    const e = fetchError(403, '[403 Forbidden] Your project has been denied access. Please contact support.');
    expect(translatedStatus(e)).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('error desconocido → 500', () => {
    expect(translatedStatus(new Error('algo inesperado'))).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
