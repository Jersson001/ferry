import { calcularDV, leerRut, validarSinRed, verificarRut, elegirMatricula, FilaRues } from './rut';
import { camposDeRut } from './verificador-rut.service';

// NITs públicos de empresas conocidas, con el DV que publica el RUES.
const CONOCIDOS: [string, number][] = [
  ['890903938', 8], // Bancolombia
  ['899999068', 1], // Ecopetrol
  ['860002964', 4], // Banco de Bogotá
  ['800197268', 4], // DIAN
  ['1020304050', 8], // Cédula como NIT de persona natural
  ['890900608', 9], // Almacenes Éxito
];

const AHORA = new Date('2026-11-11T12:00:00Z');

const bancolombia: FilaRues = {
  razon_social: 'BANCOLOMBIA S.A', numero_identificacion: '890903938', nit: '890903938', digito_verificacion: '8',
  estado_matricula: 'ACTIVA', camara_comercio: 'MEDELLIN PARA ANTIOQUIA', ultimo_ano_renovado: '2026',
  categoria_matricula: 'SOCIEDAD ó PERSONA JURIDICA PRINCIPAL ó ESAL', cod_ciiu_act_econ_pri: '6412',
};

const fetchQueDevuelve = (filas: FilaRues[]) => jest.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => filas }));

describe('calcularDV — módulo 11 de la DIAN', () => {
  it.each(CONOCIDOS)('NIT %s tiene DV %d', (nit, dv) => expect(calcularDV(nit)).toBe(dv));

  it('rechaza lo que no son dígitos', () => expect(() => calcularDV('12a')).toThrow());
});

describe('leerRut', () => {
  it.each([
    ['890.903.938-8', { numero: '890903938', dv: 8 }],
    ['NIT 890903938 - 8', { numero: '890903938', dv: 8 }],
    ['890,903,938', { numero: '890903938', dv: undefined }],
    ['  1020304050 ', { numero: '1020304050', dv: undefined }],
  ])('lee %p', (texto, esperado) => expect(leerRut(texto)).toEqual(esperado));

  it.each(['', 'abc', '1234', '12345678901', '890903938-88', '890903938-', 'RUT-1'])('no acepta %p', texto =>
    expect(leerRut(texto)).toBeNull());
});

describe('validarSinRed', () => {
  it('detecta un DV equivocado y dice cuál es el correcto', () => {
    const r = validarSinRed('890903938-7', AHORA);
    expect(r).toMatchObject({ estado: 'DV_INVALIDO' });
    expect((r as any).mensaje).toContain('debería ser 8');
  });

  it('marca el formato inválido', () => expect(validarSinRed('hola', AHORA)).toMatchObject({ estado: 'FORMATO_INVALIDO' }));

  it('con el DV correcto pide consultar el RUES', () => expect(validarSinRed('890903938-8', AHORA)).toEqual({ leido: { numero: '890903938', dv: 8 }, dv: 8 }));
});

describe('verificarRut — con el RUES', () => {
  it('verifica un NIT con matrícula activa y devuelve la razón social', async () => {
    const fetch = fetchQueDevuelve([bancolombia]);
    const r = await verificarRut('890.903.938-8', fetch, { ahora: AHORA });
    expect(r).toMatchObject({ estado: 'VERIFICADO', nit: '890903938-8', razonSocial: 'BANCOLOMBIA S.A', ultimoAnoRenovado: 2026, actividadFerreteria: false });
    expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain("numero_identificacion in('890903938')");
  });

  it('no consulta el RUES si el DV está mal', async () => {
    const fetch = fetchQueDevuelve([bancolombia]);
    expect((await verificarRut('890903938-1', fetch)).estado).toBe('DV_INVALIDO');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('NO_REGISTRADO si el RUES no tiene matrícula', async () => {
    expect((await verificarRut('900123456-8', fetchQueDevuelve([]))).estado).toBe('NO_REGISTRADO');
  });

  it('MATRICULA_INACTIVA si solo hay matrículas canceladas', async () => {
    const r = await verificarRut('890903938', fetchQueDevuelve([{ ...bancolombia, estado_matricula: 'CANCELADA' }]));
    expect(r.estado).toBe('MATRICULA_INACTIVA');
    expect(r.mensaje).toContain('cancelada');
  });

  it('MATRICULA_INACTIVA si la razón social dice que está en liquidación aunque figure activa', async () => {
    const r = await verificarRut('890903938-8', fetchQueDevuelve([{ ...bancolombia, razon_social: 'AMIGOART EN LIQUIDACION' }]), { ahora: AHORA });
    expect(r.estado).toBe('MATRICULA_INACTIVA');
  });

  it.each([['2006', 'SIN_RENOVAR'], ['0', 'SIN_RENOVAR'], [undefined, 'SIN_RENOVAR'], ['2025', 'VERIFICADO'], ['2026', 'VERIFICADO']])(
    'renovada por última vez en %p (estamos en 2026): %s', async (ano, estado) => {
      const r = await verificarRut('890903938-8', fetchQueDevuelve([{ ...bancolombia, ultimo_ano_renovado: ano }]), { ahora: AHORA });
      expect(r.estado).toBe(estado);
    });

  it('SIN_CONSULTA si el RUES no responde', async () => {
    const caido = jest.fn(async () => { throw new Error('timeout'); });
    expect(await verificarRut('890903938-8', caido)).toMatchObject({ estado: 'SIN_CONSULTA', nit: '890903938-8' });
    const error500 = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect((await verificarRut('890903938-8', error500)).estado).toBe('SIN_CONSULTA');
  });

  it('entiende un NIT con el DV pegado sin guion', async () => {
    const fetch = fetchQueDevuelve([bancolombia]); // El RUES solo conoce 890903938
    const r = await verificarRut('8909039388', fetch, { ahora: AHORA });
    expect(r).toMatchObject({ estado: 'VERIFICADO', nit: '890903938-8' });
    expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain("in('8909039388','890903938')");
  });

  it('reconoce la actividad de ferretería por el CIIU', async () => {
    const r = await verificarRut('890903938-8', fetchQueDevuelve([{ ...bancolombia, cod_ciiu_act_econ_pri: '4752' }]), { ahora: AHORA });
    expect(r.actividadFerreteria).toBe(true);
  });
});

describe('elegirMatricula', () => {
  it('prefiere la activa, luego la principal, luego la más renovada', () => {
    const cancelada = { ...bancolombia, estado_matricula: 'CANCELADA', ultimo_ano_renovado: '2030' };
    const establecimiento = { ...bancolombia, categoria_matricula: 'ESTABLECIMIENTO DE COMERCIO', ultimo_ano_renovado: '2027' };
    const vieja = { ...bancolombia, ultimo_ano_renovado: '2020' };
    expect(elegirMatricula([cancelada, establecimiento, vieja, bancolombia])).toBe(bancolombia);
  });
});

describe('camposDeRut', () => {
  const verificado = { estado: 'VERIFICADO' as const, nit: '890903938-8', mensaje: '', verificadoEn: new Date().toISOString() };

  it('guarda el NIT normalizado con su DV', async () => {
    const verificador = { verificar: jest.fn(async () => verificado) };
    expect(await camposDeRut(' 890.903.938 ', null, verificador)).toEqual({ rut: '890903938-8', rutVerificacion: verificado });
  });

  it('no vuelve a consultar si el RUT no cambió', async () => {
    const verificador = { verificar: jest.fn() };
    const r = await camposDeRut('890903938-8', { rut: '890903938-8', rutVerificacion: verificado }, verificador);
    expect(r.rutVerificacion).toBe(verificado);
    expect(verificador.verificar).not.toHaveBeenCalled();
  });

  it.each(['SIN_CONSULTA', 'SIN_RENOVAR', 'NO_REGISTRADO', 'MATRICULA_INACTIVA'] as const)(
    'vuelve a consultar el mismo RUT si quedó en %s (pudo renovar o el RUES estaba caído)', async estado => {
      const verificador = { verificar: jest.fn(async () => verificado) };
      await camposDeRut('890903938-8', { rut: '890903938-8', rutVerificacion: { ...verificado, estado } }, verificador);
      expect(verificador.verificar).toHaveBeenCalled();
    });

  it('vuelve a consultar una verificación de hace más de 30 días', async () => {
    const verificador = { verificar: jest.fn(async () => verificado) };
    const vieja = { ...verificado, verificadoEn: '2026-09-01T00:00:00Z' };
    await camposDeRut('890903938-8', { rut: '890903938-8', rutVerificacion: vieja }, verificador, new Date('2026-11-11T00:00:00Z'));
    expect(verificador.verificar).toHaveBeenCalled();
  });

  it('un DV equivocado se guarda como se escribió', async () => {
    const malo = { estado: 'DV_INVALIDO' as const, nit: '890903938-1', mensaje: '', verificadoEn: '' };
    const verificador = { verificar: jest.fn(async () => malo) };
    expect((await camposDeRut('890903938-1', null, verificador)).rut).toBe('890903938-1');
  });

  it('borrar el RUT borra la verificación', async () => {
    expect(await camposDeRut('  ', { rut: 'x', rutVerificacion: verificado }, { verificar: jest.fn() })).toEqual({ rut: null, rutVerificacion: null });
  });
});
