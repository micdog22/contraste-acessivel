// Contraste WCAG 2.x: luminância relativa, razão, critérios, sugestões de cor e matriz de paleta.
import { parseColor, effectivePair, rgbToHsl, hslToRgb, toLinear, toHex } from './color.js';

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Razão entre duas cores opacas: (L1 + 0,05) / (L2 + 0,05), com L1 a mais clara.
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Contraste do par considerando transparências (texto sobre o fundo; fundo sobre branco).
export function pairContrast(text, background) {
  const pair = effectivePair(text, background);
  return { ...pair, ratio: contrastRatio(pair.text, pair.background) };
}

export const CRITERIA = [
  { id: 'normal-aa', group: 'Texto normal', level: 'AA', min: 4.5 },
  { id: 'normal-aaa', group: 'Texto normal', level: 'AAA', min: 7 },
  { id: 'large-aa', group: 'Texto grande', level: 'AA', min: 3 },
  { id: 'large-aaa', group: 'Texto grande', level: 'AAA', min: 4.5 },
  { id: 'ui', group: 'Componentes de interface e gráficos', level: 'AA', min: 3 },
];

export function evaluate(ratio) {
  return CRITERIA.map((c) => ({ ...c, pass: ratio >= c.min }));
}

// Duas casas decimais com vírgula. Nunca mostra um valor que pareça passar num limite que a cor não atinge.
export function formatRatio(ratio) {
  let shown = Math.round(ratio * 100) / 100;
  for (const limit of [3, 4.5, 7]) {
    if (ratio < limit && shown >= limit) shown = Math.floor(ratio * 100) / 100;
  }
  return `${shown.toFixed(2).replace('.', ',')}:1`;
}

// Classificação curta para a matriz da paleta.
export function grade(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA grande';
  return 'Falha';
}

// Procura a luminosidade (L do HSL) mais próxima da original que atinge `target`, mudando só o texto ou só o fundo.
// Retorna { color, hex, ratio, lightness, delta } ou null se não houver luminosidade que chegue lá.
export function suggest(text, background, target, adjust = 'text') {
  const pair = effectivePair(text, background);
  const base = adjust === 'text' ? pair.text : pair.background;
  const { h, s, l: l0 } = rgbToHsl(base);
  const colorAt = (l) => {
    const { r, g, b } = hslToRgb(h, s, l);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: 1 };
  };
  const ratioAt = (l) => (adjust === 'text'
    ? contrastRatio(colorAt(l), pair.background)
    : pairContrast(text, colorAt(l)).ratio);

  const startRatio = ratioAt(l0);
  if (startRatio >= target) {
    return { color: colorAt(l0), hex: toHex(colorAt(l0)), ratio: startRatio, lightness: l0, delta: 0 };
  }
  const candidates = [];
  for (const end of [0, 1]) {
    if (ratioAt(end) < target) continue;
    // Busca binária: `fail` nunca atinge o alvo e `pass` sempre atinge.
    let fail = l0;
    let pass = end;
    for (let i = 0; i < 32; i++) {
      const mid = (fail + pass) / 2;
      if (ratioAt(mid) >= target) pass = mid;
      else fail = mid;
    }
    const color = colorAt(pass);
    candidates.push({ color, hex: toHex(color), ratio: ratioAt(pass), lightness: pass, delta: Math.abs(pass - l0) });
  }
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (c.delta < best.delta ? c : best));
}

// Lê uma paleta: uma ou mais cores por linha, com rótulo opcional antes da primeira ("Primária: #2563eb").
export function parsePalette(text, max = 20) {
  const colors = [];
  const errors = [];
  const TOKEN = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi;
  String(text ?? '').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const tokens = [...line.matchAll(TOKEN)];
    if (!tokens.length) {
      errors.push(`Linha ${index + 1}: nenhuma cor encontrada.`);
      return;
    }
    const label = line.slice(0, tokens[0].index).replace(/[\s:=\-–—,;|]+$/, '').trim();
    tokens.forEach((m, i) => {
      const color = parseColor(m[0]);
      if (!color) {
        errors.push(`Linha ${index + 1}: «${m[0]}» não é uma cor válida.`);
        return;
      }
      colors.push({ label: label && i === 0 && tokens.length === 1 ? label : m[0], value: m[0], color });
    });
  });
  if (colors.length > max) {
    errors.push(`Use no máximo ${max} cores; as demais foram ignoradas.`);
    colors.length = max;
  }
  return { colors, errors };
}

// matrix[i][j] = contraste da cor i como texto sobre a cor j como fundo (null na diagonal).
export function contrastMatrix(colors) {
  return colors.map((fg, i) => colors.map((bg, j) => (i === j ? null : pairContrast(fg.color, bg.color).ratio)));
}
