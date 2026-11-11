import { execFileSync } from 'child_process';
import { join } from 'path';
import { calcularDV, leerRut } from './rut';

// La skill verificar-rut de Claude Code tiene su propia copia del cálculo (un .mjs sin dependencias).
// Esta prueba corre ese script sin red y comprueba que lea y calcule igual que el backend.
const SCRIPT = join(__dirname, '../../../.claude/skills/verificar-rut/scripts/verificar-rut.mjs');

describe('paridad con la skill verificar-rut', () => {
  const entradas = ['890.903.938-8', '890903938-7', '899999068', '1020304050', 'NIT 860002964-4', '12345', 'hola', '000800197268-4'];

  it('el script y el backend dan el mismo NIT y DV', () => {
    let salida: string;
    try {
      salida = execFileSync('node', [SCRIPT, ...entradas, '--sin-red', '--json'], { encoding: 'utf8' });
    } catch (e: any) {
      salida = e.stdout; // Sale con 1 si alguno no tiene DV correcto
    }
    const resultados = JSON.parse(salida);
    resultados.forEach((r: any, i: number) => {
      const leido = leerRut(entradas[i]);
      if (!leido) return expect(r.estado).toBe('FORMATO_INVALIDO');
      const dv = calcularDV(leido.numero);
      if (leido.dv !== undefined && leido.dv !== dv) return expect(r).toMatchObject({ estado: 'DV_INVALIDO', dvCorrecto: dv });
      expect(r).toMatchObject({ estado: 'DV_CORRECTO', nit: `${leido.numero}-${dv}` });
    });
  });
});
