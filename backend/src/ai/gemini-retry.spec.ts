import { retryDelayMs, withGeminiRetry } from './gemini-retry';

// Errores con la forma y el texto exactos que devolvió Gemini en producción.
const fetchError = (status: number, text: string) =>
  Object.assign(
    new Error(
      `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: ${text}`,
    ),
    { status },
  );

const overloaded = () =>
  fetchError(
    503,
    '[503 Service Unavailable] This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
  );
const dailyQuota = () =>
  fetchError(
    429,
    '[429 Too Many Requests] You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash. Please retry in 24.371000179s.',
  );
const perMinuteLimit = () =>
  fetchError(429, '[429 Too Many Requests] Resource has been exhausted. Please retry in 2.5s.');
const creditsDepleted = () =>
  fetchError(
    429,
    '[429 Too Many Requests] Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
  );
const deniedProject = () =>
  fetchError(403, '[403 Forbidden] Your project has been denied access. Please contact support.');
const retiredModel = () =>
  fetchError(404, '[404 Not Found] This model models/gemini-2.5-flash is no longer available to new users.');

describe('retryDelayMs', () => {
  const MAX = 8000;

  it('reintenta la sobrecarga (503) con espera creciente', () => {
    const first = retryDelayMs(overloaded(), 1, MAX)!;
    const second = retryDelayMs(overloaded(), 2, MAX)!;
    expect(first).toBeGreaterThanOrEqual(1000);
    expect(first).toBeLessThan(1250);
    expect(second).toBeGreaterThanOrEqual(2000);
    expect(second).toBeLessThan(2250);
  });

  it('reintenta un 429 por minuto respetando la espera que indica Google', () => {
    expect(retryDelayMs(perMinuteLimit(), 1, MAX)).toBe(2500);
  });

  it('no reintenta la cuota diaria: pide 24 s y se agotaría igual', () => {
    expect(retryDelayMs(dailyQuota(), 1, MAX)).toBeNull();
  });

  it('no reintenta el saldo de prepago agotado', () => {
    expect(retryDelayMs(creditsDepleted(), 1, MAX)).toBeNull();
    // Google pasó a devolverlo como 402.
    const as402 = fetchError(402, '[402 Payment Required] Your prepayment credits are depleted.');
    expect(retryDelayMs(as402, 1, MAX)).toBeNull();
  });

  it('no reintenta errores de configuración', () => {
    expect(retryDelayMs(deniedProject(), 1, MAX)).toBeNull();
    expect(retryDelayMs(retiredModel(), 1, MAX)).toBeNull();
  });
});

describe('withGeminiRetry', () => {
  const noSleep = jest.fn(async () => {});
  beforeEach(() => noSleep.mockClear());

  it('se recupera si la sobrecarga pasa antes de agotar los intentos', async () => {
    const call = jest
      .fn()
      .mockRejectedValueOnce(overloaded())
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce('ok');

    await expect(withGeminiRetry(call, { sleep: noSleep })).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledTimes(2);
  });

  it('se rinde tras el máximo de intentos y relanza el último error', async () => {
    const call = jest.fn().mockRejectedValue(overloaded());

    await expect(withGeminiRetry(call, { sleep: noSleep })).rejects.toMatchObject({ status: 503 });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('no espera ni reintenta un error que no es pasajero', async () => {
    const call = jest.fn().mockRejectedValue(creditsDepleted());

    await expect(withGeminiRetry(call, { sleep: noSleep })).rejects.toMatchObject({ status: 429 });
    expect(call).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('no reintenta cuando la primera llamada funciona', async () => {
    const call = jest.fn().mockResolvedValue('ok');

    await expect(withGeminiRetry(call, { sleep: noSleep })).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(1);
  });
});
