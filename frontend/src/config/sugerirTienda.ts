// Sugiere la tienda experta (especialidad) según los productos del pedido, por palabras clave.
// Sin IA: es una sugerencia que el usuario confirma con un toque, así que basta con acertar lo común.

const PALABRAS: Record<string, string[]> = {
  'Plomería': [
    'tubo pvc', 'tuberia', 'tubería', 'codo', 'tee', 'union', 'unión', 'llave de paso', 'sifon', 'sifón', 'sanitario',
    'lavamanos', 'lavaplatos', 'griferia', 'grifería', 'registro', 'pegante pvc', 'soldadura pvc', 'limpiador pvc',
    'teflon', 'teflón', 'adaptador', 'reduccion', 'reducción', 'valvula', 'válvula', 'tanque', 'ducha', 'desague',
    'desagüe', 'cheque', 'acople', 'manguera', 'flotador', 'rejilla', 'cpvc', 'pvc',
  ],
  'Eléctricos': [
    'cable', 'alambre', 'breaker', 'taco', 'tomacorriente', 'toma', 'interruptor', 'cinta aislante', 'conduit',
    'caja electrica', 'caja eléctrica', 'extension', 'extensión', 'enchufe', 'clavija', 'tablero', 'contador',
    'polo a tierra', 'varilla cobre', 'canaleta', 'multitoma',
  ],
  'Iluminación': ['bombillo', 'led', 'lampara', 'lámpara', 'reflector', 'plafon', 'plafón', 'foco', 'luminaria', 'aplique', 'cinta led'],
  'Depósito': [
    'cemento', 'arena', 'gravilla', 'ladrillo', 'bloque', 'varilla', 'mortero', 'cal', 'pañete', 'concreto',
    'triturado', 'piedra', 'recebo', 'pega bloque', 'adoquin', 'adoquín', 'alambre negro', 'puntilla',
  ],
  'Pintura': [
    'pintura', 'vinilo', 'esmalte', 'brocha', 'rodillo', 'thinner', 'estuco', 'sellador', 'lija', 'masilla',
    'impermeabilizante', 'anticorrosivo', 'laca', 'barniz', 'aerosol', 'spray', 'galon de pintura',
  ],
  'Carpintería': [
    'madera', 'triplex', 'mdf', 'bisagra', 'corredera', 'pegante madera', 'colbon', 'colbón', 'aglomerado', 'tabla',
    'liston', 'listón', 'soporte entrepaño', 'entrepaño', 'manija', 'tirador', 'canto', 'melamina', 'tornillo madera',
  ],
  'Cerrajería': ['chapa', 'cerradura', 'candado', 'cerrojo', 'pasador', 'picaporte', 'cilindro de chapa', 'bisagra de seguridad'],
  'Gas': ['gas', 'regulador', 'cilindro de gas', 'pipeta'],
  'Estructural': [
    'perfil', 'viga', 'lamina', 'lámina', 'teja', 'angulo', 'ángulo', 'platina', 'tubo estructural', 'drywall',
    'superboard', 'malla', 'omega', 'canal', 'cercha', 'panel yeso',
  ],
  'Herramientas': [
    'martillo', 'taladro', 'broca', 'destornillador', 'alicate', 'pala', 'carretilla', 'nivel', 'flexometro',
    'flexómetro', 'metro', 'segueta', 'disco', 'pulidora', 'llave inglesa', 'guantes', 'casco', 'escalera', 'pica',
  ],
};

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Palabras completas, con plural ("codos", "uniones"). Las frases largas primero: "tubo estructural"
// antes que "tubo", "alambre negro" antes que "alambre".
const REGLAS = Object.entries(PALABRAS)
  .flatMap(([tienda, palabras]) => palabras.map(p => normalizar(p)).map(palabra => ({
    tienda,
    palabra,
    patron: new RegExp(`(?:^|[^a-z0-9])${escapar(palabra)}(?:s|es)?(?=$|[^a-z0-9])`),
  })))
  .sort((a, b) => b.palabra.length - a.palabra.length);

/** Tienda sugerida para un producto, o null si no se reconoce. */
export const tiendaDelProducto = (nombre: string): string | null => {
  const texto = normalizar(nombre);
  return REGLAS.find(r => r.patron.test(texto))?.tienda ?? null;
};

/** La tienda que más productos del pedido reconoce, con los productos que la justifican. */
export const sugerirTienda = (nombres: string[]): { tienda: string; productos: string[] } | null => {
  const votos = new Map<string, string[]>();
  for (const n of nombres) {
    const t = n.trim() && tiendaDelProducto(n);
    if (t) votos.set(t, [...(votos.get(t) ?? []), n.trim()]);
  }
  let mejor: { tienda: string; productos: string[] } | null = null;
  for (const [tienda, productos] of votos) {
    if (!mejor || productos.length > mejor.productos.length) mejor = { tienda, productos };
  }
  return mejor;
};
