import { ValueTransformer } from 'typeorm';

// Postgres devuelve las columnas `decimal` como texto ("3.40") para no perder precisión. El frontend las
// trata como número (p. ej. distanceKm.toFixed), y con texto la pantalla se rompía. Se leen como número.
export const decimalComoNumero: ValueTransformer = {
  to: (valor?: number | null) => valor,
  from: (valor?: string | number | null) => (valor === null || valor === undefined ? valor : Number(valor)),
};
