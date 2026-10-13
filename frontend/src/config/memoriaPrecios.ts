// Autocompletado de precio y SKU para una ferretería: si ya cotizó (o tiene en su catálogo) el mismo producto,
// se rellena solo. Sin IA: un precio equivocado es peor que un campo vacío, así que solo se completa cuando el
// nombre es el mismo, aunque cambien tildes, mayúsculas, signos o el orden de las palabras.

export interface EntradaMemoria {
  price: number;
  sku: string | null;
}

// "Cemento Gris (falta medida)" y "cemento  gris" son el mismo producto.
export const claveDeProducto = (nombre: string): string =>
  (nombre || '')
    .toLowerCase()
    .replace(/\(falta[^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/.]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

export interface Fuente {
  nombre: string;
  price: number;
  sku: string | null;
}

// Memoria de la ferretería (nombre → precio, SKU) y su catálogo cargado: la memoria manda porque es lo último que cotizó.
export const construirIndice = (
  memoria: Record<string, EntradaMemoria>,
  catalogo: { name: string; sku: string; price: number }[] = [],
): Map<string, EntradaMemoria> => {
  const indice = new Map<string, EntradaMemoria>();
  for (const p of catalogo) {
    if (p.name && p.price > 0) indice.set(claveDeProducto(p.name), { price: p.price, sku: p.sku || null });
  }
  for (const [nombre, entrada] of Object.entries(memoria || {})) {
    if (entrada && entrada.price > 0) indice.set(claveDeProducto(nombre), { price: entrada.price, sku: entrada.sku || null });
  }
  return indice;
};

export const buscarEnIndice = (
  indice: Map<string, EntradaMemoria>,
  item: { name: string; nombreComercial?: string | null },
): EntradaMemoria | undefined =>
  indice.get(claveDeProducto(item.name)) ??
  (item.nombreComercial ? indice.get(claveDeProducto(item.nombreComercial)) : undefined);
