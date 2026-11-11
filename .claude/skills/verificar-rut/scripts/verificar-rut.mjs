#!/usr/bin/env node
// Verifica uno o varios RUT/NIT colombianos: formato, dígito de verificación (módulo 11 de la DIAN) y
// matrícula mercantil en el RUES (datos abiertos de Confecámaras en datos.gov.co, conjunto c82u-588k).
//
// Uso:
//   node verificar-rut.mjs <rut> [<rut> ...] [--nombre "Ferretería X"] [--sin-red] [--json]
//
// Salida: un bloque por RUT (o un arreglo JSON con --json).
// Código de salida: 0 si todos quedaron VERIFICADO (o con DV correcto si --sin-red), 1 si alguno no, 2 si
// el uso es incorrecto.
//
// Mantener en sincronía con ferry/backend/src/users/rut.ts (rut.paridad.spec.ts lo comprueba).

const PESOS_DIAN = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const RUES_URL = 'https://www.datos.gov.co/resource/c82u-588k.json';
const CIIU_FERRETERIA = ['4752', '4663'];

export function calcularDV(numero) {
  let suma = 0;
  numero.split('').reverse().forEach((d, i) => { suma += Number(d) * PESOS_DIAN[i]; });
  const r = suma % 11;
  return r > 1 ? 11 - r : r;
}

export function leerRut(texto) {
  const limpio = String(texto).toUpperCase().replace(/NIT|RUT|[\s.,]/g, '');
  const m = /^(\d+)(?:-(\d))?$/.exec(limpio);
  if (!m) return null;
  const numero = m[1].replace(/^0+/, '');
  if (numero.length < 5 || numero.length > 10) return null;
  return { numero, dv: m[2] === undefined ? undefined : Number(m[2]) };
}

const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const RELLENO = new Set(['S', 'A', 'SA', 'SAS', 'LTDA', 'Y', 'CIA', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'E', 'HIJOS', 'EU', 'SCA']);
const palabras = s => sinTildes(s).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(p => p.length > 1 && !RELLENO.has(p));

/** Proporción de palabras del nombre declarado que aparecen en la razón social (0 a 1). */
export function parecidoNombre(declarado, razonSocial) {
  const a = palabras(declarado);
  const b = new Set(palabras(razonSocial));
  if (!a.length || !b.size) return 0;
  return a.filter(p => b.has(p)).length / a.length;
}

async function consultarRues(numeros) {
  const lista = numeros.map(n => `'${n}'`).join(',');
  const url = `${RUES_URL}?$limit=50&$where=${encodeURIComponent(`numero_identificacion in(${lista})`)}`;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 15000);
  try {
    const res = await fetch(url, { signal: control.signal });
    if (!res.ok) throw new Error(`RUES respondió ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(reloj);
  }
}

const esActiva = f => (f.estado_matricula ?? '').toUpperCase() === 'ACTIVA';
const esEstablecimiento = f => (f.categoria_matricula ?? '').toUpperCase().includes('ESTABLECIMIENTO');

export async function verificar(texto, { sinRed = false, nombre } = {}) {
  const leido = leerRut(texto);
  if (!leido) return { entrada: texto, estado: 'FORMATO_INVALIDO', mensaje: 'Debe ser un NIT o cédula de 5 a 10 dígitos, con el DV opcional después de un guion.' };
  const dv = calcularDV(leido.numero);
  if (leido.dv !== undefined && leido.dv !== dv) {
    return { entrada: texto, estado: 'DV_INVALIDO', nit: `${leido.numero}-${leido.dv}`, dvCorrecto: dv, mensaje: `El DV de ${leido.numero} es ${dv}, no ${leido.dv}.` };
  }
  const base = { entrada: texto, nit: `${leido.numero}-${dv}`, dvDeclarado: leido.dv ?? null };
  if (sinRed) return { ...base, estado: 'DV_CORRECTO', mensaje: 'Formato y DV correctos (sin consultar el RUES).' };

  const candidatos = [leido.numero];
  const sinUltimo = leido.numero.slice(0, -1);
  if (leido.dv === undefined && sinUltimo.length >= 5 && calcularDV(sinUltimo) === Number(leido.numero.slice(-1))) candidatos.push(sinUltimo);

  let filas;
  try {
    filas = await consultarRues(candidatos);
  } catch (e) {
    return { ...base, estado: 'SIN_CONSULTA', mensaje: `No se pudo consultar el RUES: ${e.message}` };
  }
  const exactas = filas.filter(f => f.numero_identificacion === leido.numero);
  const usadas = exactas.length ? exactas : filas;
  const numeroFinal = exactas.length || !filas.length ? leido.numero : sinUltimo;
  const matriculas = [...usadas].sort((a, b) =>
    Number(esActiva(b)) - Number(esActiva(a))
    || Number(esEstablecimiento(a)) - Number(esEstablecimiento(b))
    || Number(b.ultimo_ano_renovado ?? 0) - Number(a.ultimo_ano_renovado ?? 0));
  const f = matriculas[0];
  if (!f) return { ...base, estado: 'NO_REGISTRADO', mensaje: 'DV correcto, pero sin matrícula mercantil en el RUES con ese número.' };

  const ciiu = [f.cod_ciiu_act_econ_pri, f.cod_ciiu_act_econ_sec, f.ciiu3, f.ciiu4].filter(c => c && c !== '0' && c !== '9999');
  const datos = {
    ...base,
    nit: `${numeroFinal}-${calcularDV(numeroFinal)}`,
    razonSocial: f.razon_social?.trim(),
    tipo: f.organizacion_juridica,
    estadoMatricula: f.estado_matricula,
    camara: f.camara_comercio,
    matricula: f.matricula,
    fechaMatricula: f.fecha_matricula,
    ultimoAnoRenovado: f.ultimo_ano_renovado ? Number(f.ultimo_ano_renovado) : undefined,
    ciiu,
    actividadFerreteria: ciiu.some(c => CIIU_FERRETERIA.includes(c)),
    otrasMatriculas: matriculas.length - 1,
    ...(nombre && f.razon_social ? { parecidoNombre: Math.round(parecidoNombre(nombre, f.razon_social) * 100) / 100 } : {}),
  };
  if (!esActiva(f)) return { ...datos, estado: 'MATRICULA_INACTIVA', mensaje: `Matrícula ${String(f.estado_matricula).toLowerCase()} en el RUES.` };
  if (/EN\s+LIQUIDACI[OÓ]N/i.test(datos.razonSocial ?? '')) return { ...datos, estado: 'MATRICULA_INACTIVA', mensaje: 'Figura "ACTIVA", pero la razón social dice que está en liquidación.' };
  if (!(datos.ultimoAnoRenovado >= new Date().getUTCFullYear() - 1)) return { ...datos, estado: 'SIN_RENOVAR', mensaje: `Activa, pero renovada por última vez en ${datos.ultimoAnoRenovado || 'año desconocido'}.` };
  return { ...datos, estado: 'VERIFICADO', mensaje: 'DV correcto y matrícula activa y renovada en el RUES.' };
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const sinRed = args.includes('--sin-red');
  const i = args.indexOf('--nombre');
  const nombre = i >= 0 ? args[i + 1] : undefined;
  const ruts = args.filter((a, j) => !a.startsWith('--') && !(i >= 0 && j === i + 1));
  if (!ruts.length) {
    console.error('Uso: node verificar-rut.mjs <rut> [<rut> ...] [--nombre "Razón social"] [--sin-red] [--json]');
    process.exit(2);
  }
  const resultados = [];
  for (const r of ruts) resultados.push(await verificar(r, { sinRed, nombre }));

  if (json) console.log(JSON.stringify(resultados, null, 2));
  else for (const r of resultados) {
    console.log(`\n${r.entrada}  →  ${r.estado}`);
    for (const [k, v] of Object.entries(r)) if (k !== 'entrada' && k !== 'estado' && v !== undefined && v !== null) console.log(`  ${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  const ok = sinRed ? 'DV_CORRECTO' : 'VERIFICADO';
  process.exit(resultados.every(r => r.estado === ok) ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('verificar-rut.mjs')) {
  main();
}
