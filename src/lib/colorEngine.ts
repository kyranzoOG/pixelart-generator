/**
 * MultiCraft / Luanti Pixel Art Engine
 * Direct port of the precision color matching, Lab Delta-E distance,
 * skin-tone intelligence, and 180-degree inverted WorldEdit command generation.
 */

export interface BlockEntry {
  id: string;
  rgb: [number, number, number];
}

export type RGB = [number, number, number];

export function hexToRgb(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const WOOL_HUE: Record<string, RGB> = {
  white: hexToRgb('#eaeced'),
  grey: hexToRgb('#8e8e87'),
  dark_grey: hexToRgb('#3f4448'),
  black: hexToRgb('#15151a'),
  violet: hexToRgb('#7a2aad'),
  blue: hexToRgb('#35399d'),
  cyan: hexToRgb('#158a91'),
  dark_green: hexToRgb('#556e1c'),
  green: hexToRgb('#70b91a'),
  yellow: hexToRgb('#f9c628'),
  brown: hexToRgb('#724829'),
  orange: hexToRgb('#f17614'),
  red: hexToRgb('#a12723'),
  magenta: hexToRgb('#be45b4'),
  pink: hexToRgb('#ee8dac'),
};

export const CONCRETE_HUE: Record<string, RGB> = {
  white: hexToRgb('#cfd5d6'),
  grey: hexToRgb('#7d7d73'),
  dark_grey: hexToRgb('#373a3e'),
  black: hexToRgb('#080a0f'),
  violet: hexToRgb('#64209c'),
  blue: hexToRgb('#2d2f8f'),
  cyan: hexToRgb('#157788'),
  dark_green: hexToRgb('#495b24'),
  green: hexToRgb('#5ea919'),
  yellow: hexToRgb('#f1af15'),
  brown: hexToRgb('#603c20'),
  orange: hexToRgb('#e06101'),
  red: hexToRgb('#8e2121'),
  magenta: hexToRgb('#a9309f'),
  pink: hexToRgb('#d6658f'),
};

export const CLAY_HUE: Record<string, RGB> = {
  white: hexToRgb('#d2b2a1'),
  grey: hexToRgb('#876b62'),
  dark_grey: hexToRgb('#3a2a24'),
  black: hexToRgb('#251710'),
  violet: hexToRgb('#764656'),
  blue: hexToRgb('#4a3c5b'),
  cyan: hexToRgb('#575b5b'),
  dark_green: hexToRgb('#4c532a'),
  green: hexToRgb('#687635'),
  yellow: hexToRgb('#ba8523'),
  brown: hexToRgb('#4d3324'),
  orange: hexToRgb('#a25426'),
  red: hexToRgb('#8f3d2f'),
  magenta: hexToRgb('#96586d'),
  pink: hexToRgb('#a24e4f'),
};

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

export function buildBlockTable(): Record<string, RGB> {
  const table: Record<string, RGB> = {};

  Object.keys(CLAY_HUE).forEach((h) => {
    const base = CLAY_HUE[h];
    table['hardened_clay:' + h] = base;
    table['hardened_clay:carved_' + h] = mix(base, [0, 0, 0], 0.15);
    table['hardened_clay:cracked_' + h] = mix(base, [150, 150, 150], 0.18);
  });

  const lightHues: Record<string, string> = {
    blue: 'blue',
    cyan: 'cyan',
    green: 'green',
    magenta: 'magenta',
    orange: 'orange',
    pink: 'pink',
    red: 'red',
    violet: 'violet',
    white: 'white',
    yellow: 'yellow',
  };

  Object.keys(lightHues).forEach((blockName) => {
    const src = WOOL_HUE[lightHues[blockName]];
    table['mesecons_lightstone:lightstone_' + blockName + '_off'] = mix(
      src,
      [255, 255, 255],
      0.45
    );
  });

  Object.keys(WOOL_HUE).forEach((h) => {
    table['wool:' + h] = WOOL_HUE[h];
  });

  table['concrete:concrete'] = hexToRgb('#b0b0ac');
  Object.keys(CONCRETE_HUE).forEach((h) => {
    table['concrete:concrete_' + h] = CONCRETE_HUE[h];
  });

  table['quartz:quartz_brick_pink'] = mix(hexToRgb('#e6e1d8'), WOOL_HUE.pink, 0.35);

  // Skin tone blocks (dedicated to realistic character shading)
  table['stripped_wood:apple'] = hexToRgb('#c68642'); // medium shade
  table['stripped_wood:birch'] = hexToRgb('#e0ac69'); // fair skin
  table['sand'] = hexToRgb('#f1c27d'); // soft highlight

  return table;
}

export const BLOCK_TABLE = buildBlockTable();
export const BLOCK_ENTRIES = Object.entries(BLOCK_TABLE);

export function srgbToLinear(c: number): number {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r),
    gl = srgbToLinear(g),
    bl = srgbToLinear(b);
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  ];
}

export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const Xn = 0.95047,
    Yn = 1.0,
    Zn = 1.08883;
  function f(t: number) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }
  const fx = f(x / Xn),
    fy = f(y / Yn),
    fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export const BLOCK_LAB_ENTRIES = BLOCK_ENTRIES.map(
  ([id, c]) => [id, rgbToLab(c[0], c[1], c[2])] as [string, [number, number, number]]
);

export const SKIN_BLOCK_IDS = ['stripped_wood:apple', 'stripped_wood:birch', 'sand'];

export function isSkinToneColor(r: number, g: number, b: number): boolean {
  const maxc = Math.max(r, g, b),
    minc = Math.min(r, g, b);
  return (
    r > 95 &&
    g > 40 &&
    b > 20 &&
    maxc - minc > 15 &&
    Math.abs(r - g) > 15 &&
    r > g &&
    r > b
  );
}

export const SKIN_LAB_ENTRIES = BLOCK_LAB_ENTRIES.filter(([id]) =>
  SKIN_BLOCK_IDS.includes(id)
);
export const NORMAL_LAB_ENTRIES = BLOCK_LAB_ENTRIES.filter(
  ([id]) => !SKIN_BLOCK_IDS.includes(id)
);

export function nearestBlock(r: number, g: number, b: number): string {
  const [L, a, bb] = rgbToLab(r, g, b);
  const searchSet = isSkinToneColor(r, g, b) ? SKIN_LAB_ENTRIES : NORMAL_LAB_ENTRIES;
  let best = '';
  let bestDist = Infinity;
  for (const [id, lab] of searchSet) {
    const dL = L - lab[0],
      da = a - lab[1],
      db = bb - lab[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

export const RAINBOW_SEQUENCE = [
  'concrete:concrete_red',
  'concrete:concrete_orange',
  'concrete:concrete_yellow',
  'concrete:concrete_green',
  'concrete:concrete_cyan',
  'concrete:concrete_blue',
  'concrete:concrete_violet',
  'concrete:concrete_magenta',
  'concrete:concrete_pink',
];

export const HUE_KEYS_SORTED = [
  'dark_green',
  'dark_grey',
  'white',
  'cyan',
  'green',
  'blue',
  'yellow',
  'red',
  'orange',
  'magenta',
  'grey',
  'pink',
  'violet',
  'brown',
  'black',
];

export const HUE_LABELS: Record<string, string> = {
  white: 'White',
  grey: 'Light Grey',
  dark_grey: 'Dark Grey',
  black: 'Black',
  violet: 'Purple / Violet',
  blue: 'Blue',
  cyan: 'Cyan',
  dark_green: 'Dark Green',
  green: 'Lime Green',
  yellow: 'Yellow',
  brown: 'Brown',
  orange: 'Orange',
  red: 'Red',
  magenta: 'Magenta',
  pink: 'Pink',
};

export function hueCategoryOf(blockId: string): string {
  for (const h of HUE_KEYS_SORTED) {
    const re = new RegExp('(^|[:_])' + h + '($|[_])');
    if (re.test(blockId)) return h;
  }
  return 'grey';
}

export const BLOCKS_BY_HUE: Record<string, [string, RGB][]> = {};
HUE_KEYS_SORTED.forEach((h) => {
  BLOCKS_BY_HUE[h] = [];
});

BLOCK_ENTRIES.forEach(([id, rgb]) => {
  if (SKIN_BLOCK_IDS.includes(id)) return;
  const h = hueCategoryOf(id);
  if (!BLOCKS_BY_HUE[h]) BLOCKS_BY_HUE[h] = [];
  BLOCKS_BY_HUE[h].push([id, rgb]);
});

export interface FontStyleConfig {
  id: string;
  label: string;
  family: string;
  fallback: string;
  weight: string;
  letterSpacingEm: number;
  recommended: number;
}

export const FONT_STYLES: FontStyleConfig[] = [
  { id: 'press-start-2p', label: 'Press Start 2P (Pixel)', family: '"Press Start 2P"', fallback: 'monospace', weight: '400', letterSpacingEm: 0.02, recommended: 40 },
  { id: 'vt323', label: 'VT323 (Terminal / Pixel)', family: '"VT323"', fallback: 'monospace', weight: '400', letterSpacingEm: 0.02, recommended: 35 },
  { id: 'bungee', label: 'Bungee (Display Bold)', family: '"Bungee"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.0, recommended: 20 },
  { id: 'bangers', label: 'Bangers (Comic Book)', family: '"Bangers"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.02, recommended: 22 },
  { id: 'anton', label: 'Anton (Heavy Narrow)', family: '"Anton"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.0, recommended: 18 },
  { id: 'oswald', label: 'Oswald Bold', family: '"Oswald"', fallback: 'sans-serif', weight: '700', letterSpacingEm: 0.0, recommended: 20 },
  { id: 'bebas', label: 'Bebas Neue (Condensed)', family: '"Bebas Neue"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.02, recommended: 18 },
  { id: 'pacifico', label: 'Pacifico (Brush Script)', family: '"Pacifico"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 45 },
  { id: 'dancing', label: 'Dancing Script (Handwritten)', family: '"Dancing Script"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 45 },
  { id: 'great-vibes', label: 'Great Vibes (Calligraphy)', family: '"Great Vibes"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 50 },
  { id: 'sacramento', label: 'Sacramento (Monoline Script)', family: '"Sacramento"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 48 },
  { id: 'satisfy', label: 'Satisfy (Casual Script)', family: '"Satisfy"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 42 },
  { id: 'caveat', label: 'Caveat (Drawn Marker)', family: '"Caveat"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 38 },
  { id: 'marker', label: 'Permanent Marker (Heavy Marker)', family: '"Permanent Marker"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 25 },
  { id: 'creepster', label: 'Creepster (Horror Sharp)', family: '"Creepster"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 30 },
  { id: 'cinzel', label: 'Cinzel (Roman Classical)', family: '"Cinzel"', fallback: 'serif', weight: '400', letterSpacingEm: 0.03, recommended: 28 },
  { id: 'unifraktur', label: 'UnifrakturMaguntia (Gothic)', family: '"UnifrakturMaguntia"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 35 },
  { id: 'medieval', label: 'MedievalSharp (Medieval Era)', family: '"MedievalSharp"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 32 },
  { id: 'rye', label: 'Rye (Wild West Slab)', family: '"Rye"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 25 },
  { id: 'righteous', label: 'Righteous (Rounded Modern)', family: '"Righteous"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.0, recommended: 22 },
  { id: 'monoton', label: 'Monoton (Multi-Line Neon)', family: '"Monoton"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 20 },
  { id: 'orbitron', label: 'Orbitron (Sci-Fi High Tech)', family: '"Orbitron"', fallback: 'sans-serif', weight: '700', letterSpacingEm: 0.02, recommended: 25 },
  { id: 'audiowide', label: 'Audiowide (Futuristic Techno)', family: '"Audiowide"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.0, recommended: 25 },
  { id: 'black-ops', label: 'Black Ops One (Military Stencil)', family: '"Black Ops One"', fallback: 'sans-serif', weight: '400', letterSpacingEm: 0.0, recommended: 22 },
  { id: 'chewy', label: 'Chewy (Playful Chunky)', family: '"Chewy"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 20 },
  { id: 'fredoka', label: 'Fredoka (Soft Rounded)', family: '"Fredoka"', fallback: 'sans-serif', weight: '600', letterSpacingEm: 0.0, recommended: 20 },
  { id: 'lobster', label: 'Lobster (Bold Retro Script)', family: '"Lobster"', fallback: 'cursive', weight: '400', letterSpacingEm: 0.0, recommended: 30 },
  { id: 'playfair', label: 'Playfair Display Bold (Editorial Serif)', family: '"Playfair Display"', fallback: 'serif', weight: '700', letterSpacingEm: 0.0, recommended: 30 },
  { id: 'roboto-mono', label: 'Roboto Mono (Monospace)', family: '"Roboto Mono"', fallback: 'monospace', weight: '400', letterSpacingEm: 0.0, recommended: 30 },
  { id: 'montserrat', label: 'Montserrat Bold (Clean Default)', family: '"Montserrat"', fallback: 'sans-serif', weight: '700', letterSpacingEm: 0.0, recommended: 25 },
];

export function fontCssString(f: FontStyleConfig, sizePx: number): string {
  return `${f.weight} ${sizePx}px ${f.family}, ${f.fallback}`;
}

export function get180Rotated(blocks: (string | null)[][]): (string | null)[][] {
  const h = blocks.length;
  if (h === 0) return [];
  const w = blocks[0].length;
  const rotated: (string | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row = new Array(w);
    for (let x = 0; x < w; x++) {
      row[x] = blocks[h - 1 - y][w - 1 - x];
    }
    rotated.push(row);
  }
  return rotated;
}

export function generateWorldEditCommands(
  gridBlocks: (string | null)[][],
  w: number,
  h: number
): string[] {
  const rotated = get180Rotated(gridBlocks);
  const lines = ['/1', '/2'];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const blockId = rotated[y][x];
      if (blockId) {
        lines.push('/mix ' + blockId);
      }
      if (x < w - 1) {
        lines.push('/shift x 1');
      }
    }
    if (y < h - 1) {
      lines.push('/shift x -' + (w - 1));
      lines.push('/shift y 1');
    }
  }

  return lines;
}

export function splitIntoParts(lines: string[], n: number): string[][] {
  const total = lines.length;
  const base = Math.floor(total / n);
  let remainder = total % n;
  const parts: string[][] = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    let count = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    parts.push(lines.slice(idx, idx + count));
    idx += count;
  }
  return parts;
}
