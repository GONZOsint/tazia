// Lista de 256 palabras en español claras y fáciles de dictar (8 bits de entropía por palabra)
const SPANISH_PASSPHRASE_WORDS: readonly string[] = [
  'abrigo', 'acero', 'agua', 'aire', 'alamo', 'alba', 'aldea', 'alerce',
  'almena', 'almendra', 'amapola', 'ambar', 'ancla', 'anden', 'anillo', 'antorcha',
  'arado', 'arbol', 'arco', 'arena', 'arista', 'aroma', 'arpa', 'arroyo',
  'astilla', 'astro', 'atajo', 'atlas', 'aurora', 'avena', 'bahia', 'baliza',
  'balsa', 'bambu', 'banco', 'barca', 'barro', 'bazar', 'belleza', 'berro',
  'bisagra', 'bloque', 'bobina', 'boina', 'bosque', 'brasa', 'brecha', 'brisa',
  'brote', 'bruma', 'buho', 'buque', 'cabana', 'cable', 'cacao', 'cadena',
  'cafe', 'caja', 'caliza', 'calma', 'camino', 'campana', 'campo', 'canela',
  'canoa', 'canto', 'cana', 'capa', 'capullo', 'caracol', 'carbon', 'cardo',
  'carga', 'carpa', 'carta', 'caseta', 'cascada', 'cauce', 'cedro', 'celda',
  'ceniza', 'centro', 'cereal', 'cerro', 'cesta', 'cetro', 'chispa', 'ciclon',
  'cielo', 'cima', 'cinta', 'cipres', 'circulo', 'ciruela', 'clave', 'clima',
  'cobre', 'codigo', 'colina', 'cometa', 'compas', 'concha', 'cono', 'coral',
  'cordel', 'corona', 'corteza', 'costa', 'crater', 'cristal', 'cruce', 'cuadro',
  'cuarzo', 'cuerda', 'cumbre', 'cuna', 'dalia', 'danza', 'delta', 'deseo',
  'diente', 'dique', 'disco', 'duna', 'eco', 'edicion', 'eje', 'elice',
  'enigma', 'enlace', 'envio', 'epoca', 'ermita', 'escala', 'escudo', 'esfera',
  'espiga', 'espuma', 'establo', 'estela', 'estrella', 'etapa', 'faro', 'felpa',
  'fibra', 'ficha', 'fiesta', 'filo', 'finca', 'flauta', 'flecha', 'flor',
  'flota', 'fogon', 'folio', 'fondo', 'forma', 'fragua', 'fresa', 'fresno',
  'fronda', 'fruto', 'fuente', 'fuelle', 'gacela', 'gajo', 'galaxia', 'galeria',
  'galope', 'gamo', 'gancho', 'garza', 'gaviota', 'gema', 'gesto', 'girar',
  'globo', 'golfo', 'goma', 'gota', 'grano', 'grava', 'grieta', 'grillo',
  'gruta', 'guia', 'guion', 'halcon', 'harina', 'haya', 'hebra', 'helecho',
  'hielo', 'hierba', 'higuera', 'hilo', 'hoja', 'hogar', 'hondo', 'horno',
  'huella', 'huerto', 'humo', 'iman', 'impulso', 'indice', 'isla', 'jabon',
  'jade', 'jarra', 'jardin', 'juncos', 'lago', 'lamina', 'lana', 'lancha',
  'lanza', 'lapiz', 'largo', 'lazo', 'leche', 'lectura', 'legua', 'lengua',
  'lente', 'leona', 'letra', 'liana', 'libro', 'lienzo', 'liga', 'lima',
  'limon', 'lino', 'linterna', 'lirio', 'llama', 'llano', 'llave', 'lluvia',
  'lobo', 'lodo', 'loma', 'lona', 'loro', 'lucero', 'lucha', 'luego',
  'lugar', 'lumbre', 'luna', 'lupa', 'luz', 'madera', 'madriguera', 'magia',
];

const COMMON_WEAK_PHRASES = new Set([
  '123456',
  '12345678',
  '123456789',
  'password',
  'contraseña',
  'contrasena',
  'qwerty',
  'abcdef',
  '000000',
  'admin',
  'prueba',
]);

export function generateMemorablePassphrase(wordCount = 4): string {
  const randomIndices = new Uint8Array(wordCount);
  crypto.getRandomValues(randomIndices);
  return Array.from(randomIndices)
    .map((idx) => SPANISH_PASSPHRASE_WORDS[idx % SPANISH_PASSPHRASE_WORDS.length])
    .join('-');
}

export type PassphraseStrengthId =
  | 'empty'
  | 'weak'
  | 'short'
  | 'strong'
  | 'good'
  | 'ok';

interface PassphraseStrengthResult {
  score: 0 | 1 | 2 | 3;
  id: PassphraseStrengthId;
  isAcceptable: boolean;
}

export function evaluatePassphraseStrength(phrase: string): PassphraseStrengthResult {
  const trimmed = phrase.trim();
  if (trimmed.length === 0) {
    return { score: 0, id: 'empty', isAcceptable: false };
  }

  const lower = trimmed.toLowerCase();
  if (COMMON_WEAK_PHRASES.has(lower) || /^(.)\1+$/.test(trimmed)) {
    return { score: 0, id: 'weak', isAcceptable: false };
  }

  if (trimmed.length < 8) {
    return { score: 0, id: 'short', isAcceptable: false };
  }

  const words = trimmed.split(/[\s\-_.]+/).filter((w) => w.length >= 3);
  const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasSymbol = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/.test(trimmed);
  const charVariety = [hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (words.length >= 4 || (trimmed.length >= 16 && charVariety >= 1)) {
    return { score: 3, id: 'strong', isAcceptable: true };
  }

  if (words.length >= 3 || trimmed.length >= 12 || (trimmed.length >= 10 && charVariety >= 2)) {
    return { score: 2, id: 'good', isAcceptable: true };
  }

  return { score: 1, id: 'ok', isAcceptable: true };
}
