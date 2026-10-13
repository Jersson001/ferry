// =============================================
// CONFIGURACIÓN DE HERRAJES - Migrado de ferry_usuarios
// Tipos de productos con opciones de sugerencia para validación
// =============================================

export interface HerrajeGrupo {
    label: string;
    campo: 'medidaNominal' | 'caracteristica' | 'tipoCorredera' | 'tipoBisagra' | 'tipoSoporte';
    opciones: string[];
    scroll?: boolean;
    defaultValue?: string;
    editable?: boolean; // muestra input de texto libre además de los chips
}

export interface HerrajeSubtipo {
    cierres: string[];
    colores: string[];
}

export interface HerrajeConfig {
    keywords: string[];
    requiereTipo?: boolean;
    grupos: HerrajeGrupo[];
    subtipos?: Record<string, HerrajeSubtipo>;
}

export const HERRAJES_CONFIG: Record<string, HerrajeConfig> = {
    bisagra: {
        keywords: ['bisagra'],
        grupos: [
            {
                label: 'Tipo de montaje',
                campo: 'caracteristica',
                opciones: ['PARCHE', 'SEMIPARCHE', 'EMBEBIDA'],
            },
            {
                label: 'Función de cierre',
                campo: 'caracteristica',
                opciones: ['CIERRE SUAVE', 'CIERRE NORMAL', 'PUSH'],
            },
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['ACERO', 'NEGRO', 'INOX'],
            },
        ],
    },
    corredera: {
        keywords: ['corredera'],
        requiereTipo: true,
        grupos: [
            {
                label: 'Tipo de corredera',
                campo: 'tipoCorredera',
                opciones: ['FULL EXTENSIÓN', 'OCULTA', 'SENCILLA'],
            },
            {
                label: 'Medida',
                campo: 'medidaNominal',
                opciones: ['25cm', '30cm', '35cm', '40cm', '45cm', '50cm', '55cm', '60cm', '65cm', '70cm', '75cm', '80cm'],
                scroll: true,
            },
        ],
        subtipos: {
            'FULL EXTENSIÓN': {
                cierres: ['CIERRE SUAVE', 'CIERRE NORMAL'],
                colores: ['ACERO', 'NEGRA'],
            },
            'OCULTA': {
                cierres: ['CIERRE SUAVE', 'CIERRE NORMAL'],
                colores: [],
            },
            'SENCILLA': {
                cierres: ['CIERRE NORMAL'],
                colores: ['BLANCO', 'NEGRA', 'CAFÉ'],
            },
        },
    },
    soporte_entrepano: {
        keywords: ['soporte entrepaño', 'soporte entrepano', 'soportes entrepaño', 'soportes entrepano'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'CAFÉ', 'TRANSPARENTE'],
            },
        ],
    },
    push: {
        keywords: ['push de incrustar', 'haladera push'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'NEGRO', 'GRIS'],
            },
            {
                label: 'Tipo',
                campo: 'caracteristica',
                opciones: ['INCRUSTAR', 'SENCILLO', 'DOBLE'],
            },
        ],
    },
    brazo_neumatico: {
        keywords: ['brazo', 'neumático', 'neumatico'],
        grupos: [
            {
                label: 'Newtons',
                campo: 'medidaNominal',
                opciones: ['60nw', '80nw', '100nw', '120nw', '150nw', '180nw', '200nw'],
                scroll: true,
            },
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'GRIS', 'NEGRO'],
            },
        ],
    },
    platillero: {
        keywords: ['platillero', 'platero'],
        grupos: [
            {
                label: 'Módulo',
                campo: 'medidaNominal',
                opciones: ['MOD50', 'MOD60', 'MOD70', 'MOD80', 'MOD90', 'MOD100'],
                scroll: true,
            },
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['INOX', 'NEGRO'],
            },
        ],
    },
    cubiertero: {
        keywords: ['cubiertero'],
        grupos: [
            {
                label: 'Módulo',
                campo: 'medidaNominal',
                opciones: ['MOD30', 'MOD35', 'MOD40', 'MOD45', 'MOD50', 'MOD55', 'MOD60', 'MOD65', 'MOD70', 'MOD75', 'MOD80', 'MOD85', 'MOD90', 'MOD95', 'MOD100'],
                scroll: true,
            },
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['GRIS CLARO', 'GRIS OSCURO', 'BLANCO'],
            },
        ],
    },
    basurera: {
        keywords: ['basurera', 'basurero', 'shut'],
        grupos: [
            {
                label: 'Módulo',
                campo: 'medidaNominal',
                opciones: ['MOD45', 'MOD50', 'MOD60', 'MOD90'],
            },
            {
                label: 'Función de cierre',
                campo: 'caracteristica',
                opciones: ['CIERRE SUAVE', 'CIERRE NORMAL', 'PUSH'],
            },
        ],
    },
    condimentero: {
        keywords: ['condimentero', 'canastilla', 'canastillas'],
        grupos: [
            {
                label: 'Módulo',
                campo: 'medidaNominal',
                opciones: ['MOD15', 'MOD18', 'MOD20'],
            },
            {
                label: 'Función de cierre',
                campo: 'caracteristica',
                opciones: ['CIERRE SUAVE', 'CIERRE NORMAL', 'PUSH'],
            },
        ],
    },
    tornillo: {
        keywords: ['tornillo'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['ZINCADO', 'NEGRO'],
            },
        ],
    },
    broca: {
        keywords: ['broca'],
        grupos: [
            {
                label: 'Tipo de punta',
                campo: 'caracteristica',
                opciones: ['MADERA', 'METAL', 'TUNGSTENO'],
            },
        ],
    },
    tubo: {
        keywords: ['tubo', 'tubos', 'tubo carpintería', 'tubo carpinteria'],
        grupos: [
            { label: 'Color', campo: 'caracteristica', opciones: ['CROMADO', 'MATE', 'NEGRO'] },
            { label: 'Forma', campo: 'caracteristica', opciones: ['OVALADO', 'REDONDO'] },
        ],
    },
    soporte_tubo: {
        keywords: ['soporte tubo', 'soportes tubo', 'soporte para tubo', 'soportes para tubo'],
        grupos: [
            { label: 'Color', campo: 'caracteristica', opciones: ['CROMADO', 'MATE', 'NEGRO'] },
            { label: 'Forma', campo: 'caracteristica', opciones: ['OVALADO', 'REDONDO'] },
        ],
    },
    soporte_oculto: {
        keywords: ['soporte oculto', 'soportes ocultos'],
        grupos: [
            { label: 'Medida', campo: 'medidaNominal', opciones: ['15CM', '20CM', '25CM', '30CM'] },
        ],
    },
    soporte: {
        keywords: ['soporte', 'soportes'],
        grupos: [
            { label: 'Tipo de soporte', campo: 'tipoSoporte', opciones: ['SOPORTE ENTREPAÑO', 'SOPORTE TUBO'] },
        ],
    },

    // ── PINTURAS ──────────────────────────────────────────────────────────────
    vinilo: {
        keywords: ['vinilo', 'vinilos', 'vinilo tipo', 'vinilo tp'],
        grupos: [
            {
                label: 'Tipo',
                campo: 'caracteristica',
                opciones: [
                    'TIPO 1 — Premium (lavable, alto tráfico)',
                    'TIPO 2 — Estándar (semilavable, alcobas)',
                    'TIPO 3 — Económico (techos / fondeo)',
                ],
                defaultValue: 'TIPO 2 — Estándar (semilavable, alcobas)',
            },
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO'],
                defaultValue: 'BLANCO',
                editable: true,
            },
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['1/4 GL', '1/2 GL', '1 GL', '5 GL'],
            },
        ],
    },
    acrilico: {
        keywords: ['acrilico', 'acrílico', 'acrílica', 'acrilica', 'pintura acrilica', 'pintura acrílica'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'MARFIL', 'BEIGE', 'ARENA', 'GRIS', 'GRIS CLARO', 'GRIS OSCURO', 'NEGRO', 'CAFÉ', 'TERRACOTA', 'AZUL', 'VERDE', 'ROJO', 'AMARILLO', 'NARANJA'],
                scroll: true,
            },
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['1/4 GL', '1/2 GL', '1 GL', '5 GL'],
            },
        ],
    },
    esmalte: {
        keywords: ['esmalte', 'esmaltes'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'NEGRO', 'GRIS', 'CAFÉ', 'AZUL', 'VERDE', 'ROJO', 'AMARILLO', 'NARANJA', 'ALUMINIO'],
                scroll: true,
            },
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['1/4 GL', '1/2 GL', '1 GL', '5 GL'],
            },
        ],
    },
    pintura: {
        keywords: ['pintura', 'pinturas'],
        grupos: [
            {
                label: 'Color',
                campo: 'caracteristica',
                opciones: ['BLANCO', 'MARFIL', 'BEIGE', 'ARENA', 'GRIS', 'NEGRO', 'CAFÉ', 'TERRACOTA', 'AZUL', 'VERDE', 'ROJO', 'AMARILLO', 'NARANJA'],
                scroll: true,
            },
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['1/4 GL', '1/2 GL', '1 GL', '5 GL'],
            },
        ],
    },
    stucco: {
        keywords: ['stucco', 'estuco', 'estucos'],
        grupos: [
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['5 KG', '10 KG', '25 KG'],
            },
        ],
    },

    // ── ILUMINACIÓN ──────────────────────────────────────────────────────────
    bala_led: {
        keywords: ['bala', 'balas', 'bala led', 'balas led', 'downlight', 'ojo de buey', 'panel led', 'panel empotrado'],
        grupos: [
            {
                label: 'Potencia / Medida exterior',
                campo: 'medidaNominal',
                opciones: [
                    '3W (Ø 8.5-9 cm)',
                    '6W (Ø 11.5-12 cm)',
                    '9W (Ø 14.5-15 cm)',
                    '12W (Ø 17-17.5 cm)',
                    '18W (Ø 22-22.5 cm)',
                    '24W (Ø 29.5-30 cm)',
                ],
                defaultValue: '6W (Ø 11.5-12 cm)',
            },
            {
                label: 'Forma',
                campo: 'caracteristica',
                opciones: ['REDONDA', 'CUADRADA'],
                defaultValue: 'REDONDA',
            },
        ],
    },

    rodillo: {
        keywords: ['rodillo', 'rodillos'],
        grupos: [
            {
                label: 'Ancho (maneral)',
                campo: 'medidaNominal',
                opciones: ['2" — Junior (detalles)', '4-6" — Mini (retoque)', '9" — Estándar (paredes)'],
                defaultValue: '9" — Estándar (paredes)',
            },
            {
                label: 'Material',
                campo: 'caracteristica',
                opciones: [
                    'SINTÉTICO (vinilo/acrílico)',
                    'LANA NATURAL (aceite/esmalte)',
                    'ESPUMA PORO 0 (barniz/laca)',
                    'MICROFIBRA (epóxico/líquidos)',
                ],
                defaultValue: 'SINTÉTICO (vinilo/acrílico)',
            },
        ],
    },

    // ── FIJACIÓN / ANCLAJE ───────────────────────────────────────────────────
    perno: {
        keywords: ['perno', 'pernos', 'perno cal', 'pernos cal', 'cartucho', 'cartuchos'],
        grupos: [
            {
                label: 'Calibre',
                campo: 'medidaNominal',
                opciones: ['.22 (tiro a tiro)', '.25 (semiautomático)', '.27 (automático — tira)'],
                defaultValue: '.22 (tiro a tiro)',
            },
            {
                label: 'Potencia (color)',
                campo: 'caracteristica',
                opciones: [
                    'MARRÓN (nivel 2 — concreto suave)',
                    'VERDE (nivel 3 — estándar)',
                    'AMARILLO (nivel 4 — concreto duro)',
                    'ROJO (nivel 5 — estructura metálica)',
                ],
                defaultValue: 'VERDE (nivel 3 — estándar)',
            },
        ],
    },

    // ── AGREGADOS / MATERIALES A GRANEL ──────────────────────────────────────
    arena: {
        keywords: ['arena'],
        grupos: [
            {
                label: 'Tipo',
                campo: 'caracteristica',
                opciones: ['DE RÍO', 'DE PEÑA'],
                defaultValue: 'DE RÍO',
            },
            {
                label: 'Presentación',
                campo: 'medidaNominal',
                opciones: ['M³', 'SACO'],
                defaultValue: 'M³',
            },
        ],
    },

    // ── DRYWALL / MATERIALES DE CONSTRUCCIÓN ─────────────────────────────────
    angulo_drywall: {
        keywords: [
            'angulo', 'ángulo',
            'angulo drywall', 'ángulo drywall', 'angulo de drywall', 'ángulo de drywall',
            'angulo perimetral', 'ángulo perimetral', 'angulo metalico', 'ángulo metálico',
            'angulo cuelga', 'cuelga', 'esquinero drywall',
        ],
        grupos: [
            {
                label: 'Tipo',
                campo: 'caracteristica',
                opciones: ['PERIMETRAL', 'CUELGA', 'ESQUINERO'],
                defaultValue: 'PERIMETRAL',
            },
            {
                label: 'Alas',
                campo: 'medidaNominal',
                opciones: ['20x20 mm', '20x30 mm', '24x24 mm', '35 mm'],
                defaultValue: '20x20 mm',
            },
            {
                label: 'Largo',
                campo: 'caracteristica',
                opciones: ['2.44 m', '3.05 m'],
                defaultValue: '2.44 m',
            },
            {
                label: 'Calibre',
                campo: 'caracteristica',
                opciones: ['Cal 26 (0.38-0.45 mm)', 'Cal 20-24 (0.55-0.90 mm)'],
                defaultValue: 'Cal 26 (0.38-0.45 mm)',
            },
        ],
    },
    omega: {
        keywords: ['omega', 'perfil omega', 'canal omega'],
        grupos: [
            {
                label: 'Largo',
                campo: 'medidaNominal',
                opciones: ['2.44 m', '3.05 m'],
                defaultValue: '2.44 m',
            },
            {
                label: 'Calibre',
                campo: 'caracteristica',
                opciones: ['0.35-0.40 mm (ligero)', 'Cal 26 (0.43-0.55 mm)', 'Cal 20-22 (0.90 mm)'],
                defaultValue: 'Cal 26 (0.43-0.55 mm)',
            },
        ],
    },
    drywall: {
        keywords: ['drywall', 'dry wall', 'tabla roca', 'tablaroca', 'yeso laminado'],
        grupos: [
            {
                label: 'Espesor',
                campo: 'caracteristica',
                opciones: ['1/4" (6.4 mm)', '3/8" (9.5 mm)', '1/2" (12.7 mm)', '5/8" (15.9 mm)'],
                defaultValue: '1/2" (12.7 mm)',
            },
        ],
    },
    tornillo_drywall: {
        keywords: ['tornillo drywall', 'tornillos drywall', 'tornillo para drywall', 'tornillos para drywall', 'tornillo de drywall'],
        grupos: [
            { label: 'Largo', campo: 'medidaNominal', opciones: ['1"', '1 1/4"', '1 5/8"', '2"'] },
            { label: 'Punta', campo: 'caracteristica', opciones: ['PUNTA FINA', 'PUNTA BROCA'], defaultValue: 'PUNTA FINA' },
        ],
    },
    cinta_drywall: {
        keywords: ['cinta de papel', 'cinta papel', 'cinta drywall', 'cinta de drywall', 'cinta para drywall', 'cinta malla', 'cinta de malla'],
        grupos: [
            { label: 'Tipo', campo: 'caracteristica', opciones: ['PAPEL', 'MALLA'] },
        ],
    },
    masilla: {
        keywords: ['masilla', 'super mastic', 'supermastic', 'super mastick', 'supermastick'],
        grupos: [
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['1 GL', '5 GL'] },
        ],
    },

    // ── OBRA GRIS / ESTRUCTURA ───────────────────────────────────────────────
    cemento: {
        keywords: ['cemento', 'cementos'],
        grupos: [
            { label: 'Tipo', campo: 'caracteristica', opciones: ['USO GENERAL', 'ESTRUCTURAL', 'BLANCO'], defaultValue: 'USO GENERAL' },
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['25 KG', '50 KG'], defaultValue: '50 KG' },
        ],
    },
    yeso: {
        keywords: ['yeso', 'yesos'],
        grupos: [
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['5 KG', '10 KG', '25 KG'] },
        ],
    },
    pegante_ceramica: {
        keywords: [
            'pegacor', 'pegante ceramica', 'pegante para ceramica', 'adhesivo ceramica',
            'pegante porcelanato', 'pegante para porcelanato',
        ],
        grupos: [
            { label: 'Tipo', campo: 'caracteristica', opciones: ['GRIS', 'BLANCO', 'PORCELANATO'], defaultValue: 'GRIS' },
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['5 KG', '25 KG'], defaultValue: '25 KG' },
        ],
    },
    akronal: {
        keywords: ['akronal', 'acronal', 'aditivo'],
        grupos: [
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['1/4 GL', '1/2 GL', '1 GL', '5 GL'] },
        ],
    },
    varilla: {
        keywords: ['varilla', 'varillas', 'hierro corrugado'],
        grupos: [
            { label: 'Diámetro', campo: 'medidaNominal', opciones: ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"', '1"'] },
            { label: 'Tipo', campo: 'caracteristica', opciones: ['CORRUGADA', 'LISA'], defaultValue: 'CORRUGADA' },
        ],
    },
    varilla_roscada: {
        keywords: ['varilla roscada', 'varillas roscadas', 'esparrago'],
        grupos: [
            { label: 'Diámetro', campo: 'medidaNominal', opciones: ['1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"'] },
        ],
    },
    malla_electrosoldada: {
        keywords: ['malla electrosoldada', 'electrosoldada'],
        grupos: [
            { label: 'Diámetro y separación', campo: 'medidaNominal', opciones: ['4MM 15x15', '4MM 25x25', '5MM 15x15', '6MM 15x15', '6MM 20x20'] },
            { label: 'Formato', campo: 'caracteristica', opciones: ['PANEL', 'ROLLO'], defaultValue: 'PANEL' },
        ],
    },
    alambre: {
        keywords: ['alambre', 'alambres'],
        grupos: [
            { label: 'Calibre', campo: 'medidaNominal', opciones: ['12', '14', '16', '18', '20'] },
            { label: 'Tipo', campo: 'caracteristica', opciones: ['NEGRO RECOCIDO', 'GALVANIZADO', 'DE PÚAS'], defaultValue: 'NEGRO RECOCIDO' },
        ],
    },
    puntilla: {
        keywords: ['puntilla', 'puntillas', 'clavo', 'clavos'],
        grupos: [
            { label: 'Largo', campo: 'medidaNominal', opciones: ['1"', '1 1/2"', '2"', '2 1/2"', '3"', '4"', '5"'] },
            { label: 'Cabeza', campo: 'caracteristica', opciones: ['CON CABEZA', 'SIN CABEZA'], defaultValue: 'CON CABEZA' },
        ],
    },
    bloque: {
        keywords: [' bloque ', ' bloques '],
        grupos: [
            { label: 'Número', campo: 'medidaNominal', opciones: ['No. 4', 'No. 5', 'No. 6', 'No. 8', 'No. 10', 'No. 12'] },
            { label: 'Material', campo: 'caracteristica', opciones: ['ARCILLA', 'CEMENTO'] },
        ],
    },
    ladrillo: {
        keywords: ['ladrillo', 'ladrillos', 'tolete'],
        grupos: [
            { label: 'Tipo', campo: 'caracteristica', opciones: ['TOLETE', 'FAROL', 'PRENSADO'] },
        ],
    },
    gravilla: {
        keywords: ['gravilla', 'grava', 'triturado', 'balasto'],
        grupos: [
            { label: 'Tamaño', campo: 'medidaNominal', opciones: ['1/2"', '3/4"', '1"'] },
            { label: 'Presentación', campo: 'caracteristica', opciones: ['M³', 'SACO'], defaultValue: 'M³' },
        ],
    },
    recebo: {
        keywords: ['recebo', 'ripio'],
        grupos: [
            { label: 'Presentación', campo: 'medidaNominal', opciones: ['M³', 'SACO'], defaultValue: 'M³' },
        ],
    },

    // ── HERRAMIENTA DE ACABADOS ──────────────────────────────────────────────
    brocha: {
        keywords: ['brocha', 'brochas'],
        grupos: [
            { label: 'Tamaño', campo: 'medidaNominal', opciones: ['1"', '1 1/2"', '2"', '2 1/2"', '3"', '4"'] },
        ],
    },
    lija: {
        keywords: [' lija ', ' lijas '],
        grupos: [
            { label: 'Grano', campo: 'medidaNominal', opciones: ['60', '80', '100', '120', '150', '180', '220', '240', '320', '400'], scroll: true },
            { label: 'Tipo', campo: 'caracteristica', opciones: ['AGUA', 'MADERA', 'HIERRO'], defaultValue: 'AGUA' },
        ],
    },

    // ── TUBERÍA ──────────────────────────────────────────────────────────────
    tuberia_pvc: {
        keywords: ['tubo pvc', 'tubos pvc', 'tuberia pvc', 'tuberias pvc', 'tuberia', 'tuberias'],
        grupos: [
            { label: 'Diámetro', campo: 'medidaNominal', opciones: ['1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"', '3"', '4"', '6"'] },
            { label: 'Tipo', campo: 'caracteristica', opciones: ['SANITARIA', 'PRESIÓN', 'CONDUIT'] },
        ],
    },
};

// Productos que requieren información complementaria (medida + característica)
export const PRODUCTOS_INFO_COMPLEMENTARIA = [
    { keywords: ['condimentero', 'condimenteros'] },
    { keywords: ['basurera', 'basureras', 'basurero'] },
    { keywords: ['platillero', 'platilleros'] },
    { keywords: ['cubiertero', 'cubierteros'] },
    { keywords: ['brazo', 'brazos'] },
    { keywords: ['tubo', 'tubos'] },
    { keywords: ['soporte', 'soportes'] },
    { keywords: ['rodachina', 'rodachinas'] },
    { keywords: ['riel', 'rieles'] },
    { keywords: ['corredera', 'correderas'] },
    { keywords: ['broca', 'brocas'] },
];

export const MODULE_PRODUCTS = ['cubiertero', 'platillero', 'platero', 'condimentero', 'basurera', 'basurero'];

// =============================================
// FUZZY MATCHING - Corrección de errores de OCR
// =============================================

/**
 * Distancia de Levenshtein entre dos strings (número mínimo de ediciones)
 */
const levenshteinDistance = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
};

// Palabras comunes que nunca son destino de una corrección: están a una letra de otras palabras reales
// (GRAPA -> GRAVA, LIMA -> LISA, LISA -> LIJA, PUNTO -> PUNTA, SANITARIO -> SANITARIA).
const TERMINOS_NO_CORREGIBLES = ['LISA', 'LIJA', 'FINA', 'PUNTA', 'AGUA', 'ROLLO', 'GRAVA', 'SANITARIA'];

/**
 * Recopila todos los términos conocidos del config de herrajes (keywords + opciones)
 */
const getAllKnownTerms = (): string[] => {
    const terms = new Set<string>();
    for (const config of Object.values(HERRAJES_CONFIG)) {
        config.keywords.forEach(k => k.split(/\s+/).forEach(w => { if (w.length >= 4) terms.add(w.toUpperCase()); }));
        config.grupos.forEach(g => {
            g.opciones.forEach(op => op.split(/\s+/).forEach(w => { if (w.length >= 4) terms.add(w.toUpperCase()); }));
        });
        if (config.subtipos) {
            Object.values(config.subtipos).forEach(st => {
                st.cierres.forEach(c => c.split(/\s+/).forEach(w => { if (w.length >= 4) terms.add(w.toUpperCase()); }));
                st.colores.forEach(c => c.split(/\s+/).forEach(w => { if (w.length >= 4) terms.add(w.toUpperCase()); }));
            });
        }
    }
    // Agregar keywords de productos complementarios
    PRODUCTOS_INFO_COMPLEMENTARIA.forEach(p => p.keywords.forEach(k => { if (k.length >= 4) terms.add(k.toUpperCase()); }));
    TERMINOS_NO_CORREGIBLES.forEach(t => terms.delete(t));
    return Array.from(terms);
};

let _cachedTerms: string[] | null = null;
const getKnownTerms = () => {
    if (!_cachedTerms) _cachedTerms = getAllKnownTerms();
    return _cachedTerms;
};

// Palabras reales a una edición de un término del catálogo (BROCHA -> BROCA): nunca se corrigen.
const PALABRAS_PROTEGIDAS = new Set(['BROCHA', 'BROCHAS', 'MARTILLO', 'MARTILLOS', 'CLAVO', 'CLAVOS', 'CARPINTERO', 'CARPINTEROS']);

/**
 * Encuentra el mejor match fuzzy para una palabra contra términos conocidos.
 * Retorna la corrección si la distancia es ≤ maxDist, o null si no hay match cercano.
 */
const fuzzyMatchWord = (word: string, maxDist = 2): string | null => {
    if (word.length < 4) return null; // palabras muy cortas no se corrigen
    const upper = word.toUpperCase();
    if (PALABRAS_PROTEGIDAS.has(upper)) return null;
    const terms = getKnownTerms();

    // Con 2 ediciones palabras reales cambian de significado (MARTILLO -> AMARILLO, TEJA -> PEÑA)
    const currentMaxDist = upper.length <= 8 ? 1 : maxDist;
    
    let bestMatch: string | null = null;
    let bestDist = currentMaxDist + 1;
    for (const term of terms) {
        // Solo comparar con términos de longitud similar
        if (Math.abs(term.length - upper.length) > currentMaxDist) continue;
        const dist = levenshteinDistance(upper, term);
        if (dist === 0) return null; // Ya es exacto, no corregir
        if (dist <= currentMaxDist && dist < bestDist) {
            bestDist = dist;
            bestMatch = term;
        }
    }
    return bestMatch;
};

/**
 * Corrige errores de OCR en un nombre de producto usando fuzzy matching.
 * Ej: "BASURERA CUERRE SUAVE" → "BASURERA CIERRE SUAVE"
 */
export const corregirNombreOCR = (nombre: string): string => {
    if (!nombre) return nombre;
    // Expandir abreviaciones comunes de contratistas
    let resultado = nombre.replace(/\bCS\b/gi, 'CIERRE SUAVE').replace(/\bCN\b/gi, 'CIERRE NORMAL');
    // Primero intentar match de frases completas (opciones multi-palabra como "CIERRE SUAVE")
    for (const config of Object.values(HERRAJES_CONFIG)) {
        for (const grupo of config.grupos) {
            for (const opcion of grupo.opciones) {
                const palabrasOpcion = opcion.toUpperCase().split(/\s+/);
                if (palabrasOpcion.length < 2) continue;
                // Buscar la frase completa con fuzzy en cada posición
                const palabrasTexto = resultado.toUpperCase().split(/\s+/);
                for (let i = 0; i <= palabrasTexto.length - palabrasOpcion.length; i++) {
                    const fragmento = palabrasTexto.slice(i, i + palabrasOpcion.length);
                    let distTotal = 0;
                    let allClose = true;
                    for (let j = 0; j < palabrasOpcion.length; j++) {
                        const d = levenshteinDistance(fragmento[j], palabrasOpcion[j]);
                        distTotal += d;
                        if (d > 2) { allClose = false; break; }
                    }
                    if (allClose && distTotal > 0 && distTotal <= 3) {
                        // Reemplazar el fragmento mal escrito con la opción correcta
                        const palabrasOrig = resultado.split(/\s+/);
                        const before = palabrasOrig.slice(0, i).join(' ');
                        const after = palabrasOrig.slice(i + palabrasOpcion.length).join(' ');
                        resultado = [before, opcion.toUpperCase(), after].filter(s => s).join(' ');
                    }
                }
            }
        }
    }
    // Luego corregir palabras individuales que no se hayan corregido ya
    const palabras = resultado.split(/\s+/);
    const corregidas = palabras.map(p => {
        const correccion = fuzzyMatchWord(p);
        return correccion || p;
    });
    return corregidas.join(' ');
};

/**
 * Busca la configuración de un producto por su nombre comercial (con fuzzy matching)
 */
const quitarTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const escaparRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Minúsculas, sin tildes y rodeado de espacios, para que una keyword con espacios (' lija ') solo case palabras completas.
const prepararTexto = (texto: string): string =>
    ` ${quitarTildes(texto.toLowerCase()).replace(/[^\p{L}\p{N}/.]+/gu, ' ')} `;

let _keywordsNormalizadas: Array<{ config: HerrajeConfig; keyword: string }> | null = null;
const getKeywordsNormalizadas = () => {
    if (!_keywordsNormalizadas) {
        _keywordsNormalizadas = Object.values(HERRAJES_CONFIG).flatMap(config =>
            config.keywords.map(k => ({ config, keyword: quitarTildes(k.toLowerCase()) })));
    }
    return _keywordsNormalizadas;
};

// Gana la keyword más larga: así 'tornillo drywall' vence a 'tornillo' y 'yeso laminado' a 'yeso'.
const buscarConfigPorKeyword = (texto: string): HerrajeConfig | null => {
    let mejor: HerrajeConfig | null = null;
    let largo = 0;
    for (const { config, keyword } of getKeywordsNormalizadas()) {
        if (keyword.length > largo && texto.includes(keyword)) {
            mejor = config;
            largo = keyword.length;
        }
    }
    return mejor;
};

export const getConfigProducto = (nombreComercial: string): HerrajeConfig | null => {
    if (!nombreComercial) return null;
    const nombre = prepararTexto(nombreComercial);
    const directo = buscarConfigPorKeyword(nombre);
    if (directo) return directo;
    // Fallback: buscar con nombre corregido
    const corregido = prepararTexto(corregirNombreOCR(nombreComercial));
    return corregido !== nombre ? buscarConfigPorKeyword(corregido) : null;
};

// Números del texto, con fracciones y mixtos: "1 1/2" es un solo número y "1/2" no es "1" ni "2".
const REGEX_NUMERO = /\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?/g;

const normalizarNumero = (n: string): string => n.replace(/\s+/g, ' ').replace(',', '.');

const numerosDelTexto = (texto: string): Set<string> => {
    // "TIPO 2" / "TP 1" es la categoría del producto, no una medida
    const limpio = texto.replace(/\b(?:tipo|tp)\s*\d+\b/gi, ' ');
    const numeros = new Set<string>();
    for (const m of limpio.match(REGEX_NUMERO) || []) {
        const n = normalizarNumero(m);
        numeros.add(n);
        // "2 1/2" también puede ser "2" seguido de "1/2" (ej: "TIPO 2 1/2 GL")
        if (n.includes(' ')) n.split(' ').forEach(parte => numeros.add(parte));
    }
    return numeros;
};

// Opción hecha solo de número y unidad ('5/8"', '2.44 m'): se compara por el número, no por el texto
const OPCION_NUMERICA = /^[\d\s./"'x-]+(?:MM|CM|M|KG|GL|W)?$/;

/**
 * Intenta inferir la medida nominal de un producto basándose en su nombre
 */
export const inferirMedidaNominal = (nombreComercial: string, medidaNominalActual: string): string => {
    if (medidaNominalActual && !medidaNominalActual.includes('falta')) {
        return medidaNominalActual;
    }
    const config = getConfigProducto(nombreComercial);
    if (!config) return medidaNominalActual;
    const grupoMedida = config.grupos.find(g => g.campo === 'medidaNominal');
    if (!grupoMedida) return medidaNominalActual;

    const numerosNombre = numerosDelTexto(nombreComercial);
    if (numerosNombre.size === 0) return grupoMedida.defaultValue || medidaNominalActual;

    // Gana la opción con más coincidencias (1 1/2 pesa más que 1); si dos empatan no se adivina
    let mejor: string | null = null;
    let mejorPuntaje = 0;
    let empate = false;
    for (const op of grupoMedida.opciones) {
        const sinNota = op.replace(/\s*[—(].*$/, '');
        const numerosOpcion = new Set((sinNota.match(REGEX_NUMERO) || []).map(normalizarNumero));
        let puntaje = 0;
        numerosOpcion.forEach(n => { if (numerosNombre.has(n)) puntaje += n.length; });
        if (puntaje > mejorPuntaje) {
            mejor = op;
            mejorPuntaje = puntaje;
            empate = false;
        } else if (puntaje > 0 && puntaje === mejorPuntaje) {
            empate = true;
        }
    }
    return (!empate && mejor) || grupoMedida.defaultValue || medidaNominalActual;
};

/**
 * Intenta inferir la característica de un producto basándose en su nombre (con fuzzy matching)
 */
export const inferirCaracteristica = (nombreComercial: string, caracteristicaActual: string): string => {
    if (caracteristicaActual && !caracteristicaActual.includes('falta')) {
        return caracteristicaActual;
    }
    const config = getConfigProducto(nombreComercial);
    if (!config) return caracteristicaActual;
    const gruposCaracteristica = config.grupos.filter(g => g.campo === 'caracteristica');
    if (!gruposCaracteristica.length) return caracteristicaActual;
    // Buscar con nombre corregido para capturar typos del OCR
    const nombreCorregido = corregirNombreOCR(nombreComercial);
    const nombreUpper = quitarTildes(nombreCorregido.toUpperCase());
    const numerosNombre = numerosDelTexto(nombreCorregido);
    // Un valor por grupo: el que aparece en el nombre o, si no aparece, el valor por defecto del grupo
    const partes: string[] = [];
    for (const grupo of gruposCaracteristica) {
        const opcionEncontrada = grupo.opciones.find(op => {
            const opUpper = quitarTildes(op.toUpperCase());
            // Match exacto contra el texto completo de la opción
            if (nombreUpper.includes(opUpper)) return true;
            const nucleo = opUpper.replace(/\s*[—(].*$/, '').trim();
            if (OPCION_NUMERICA.test(nucleo)) {
                const numerosOpcion = (nucleo.match(REGEX_NUMERO) || []).map(normalizarNumero);
                return numerosOpcion.length > 0 && numerosOpcion.every(n => numerosNombre.has(n));
            }
            // Match por palabra clave: primera parte antes del paréntesis (ej: "VERDE" de "VERDE (nivel 3...)")
            const keyword = opUpper.replace(/\s*\(.*$/, '').trim();
            if (keyword.length >= 3) {
                return new RegExp(`\\b${escaparRegex(keyword)}\\b`).test(nombreUpper);
            }
            return false;
        });
        if (opcionEncontrada) partes.push(opcionEncontrada);
        else if (grupo.defaultValue) partes.push(grupo.defaultValue);
    }
    return partes.length > 0 ? partes.join(', ') : caracteristicaActual;
};

