import { normalizarCodigo, generarCodigo, limpiarNombre, estaEnPlazo, DIAS_PARA_RECLAMAR } from './referidos';

describe('normalizarCodigo', () => {
  it('pasa a mayúsculas y acepta solo letras y números de 3 a 20', () => {
    expect(normalizarCodigo(' leo ')).toBe('LEO');
    expect(normalizarCodigo('ab')).toBeNull();
    expect(normalizarCodigo('con espacio')).toBeNull();
    expect(normalizarCodigo('A'.repeat(21))).toBeNull();
    expect(normalizarCodigo(undefined)).toBeNull();
  });
});

describe('generarCodigo', () => {
  it('genera 6 caracteres válidos y sin símbolos ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo();
      expect(normalizarCodigo(c)).toBe(c);
      expect(c).toHaveLength(6);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });
});

describe('limpiarNombre', () => {
  it('recorta, junta espacios y rechaza lo vacío', () => {
    expect(limpiarNombre('  Ferretería   El Tornillo ')).toBe('Ferretería El Tornillo');
    expect(limpiarNombre('   ')).toBeNull();
    expect(limpiarNombre('x'.repeat(100))).toHaveLength(60);
  });
});

describe('estaEnPlazo', () => {
  const ahora = new Date('2026-11-20T12:00:00Z');
  const hace = (dias: number) => new Date(ahora.getTime() - dias * 86400000);
  it('acepta cuentas recién creadas y rechaza las antiguas', () => {
    expect(estaEnPlazo(hace(0), ahora)).toBe(true);
    expect(estaEnPlazo(hace(DIAS_PARA_RECLAMAR - 0.1), ahora)).toBe(true);
    expect(estaEnPlazo(hace(DIAS_PARA_RECLAMAR + 1), ahora)).toBe(false);
  });
  it('rechaza fechas en el futuro', () => {
    expect(estaEnPlazo(new Date(ahora.getTime() + 60000), ahora)).toBe(false);
  });
});
