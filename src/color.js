// Leitura de cores CSS (#hex, rgb/rgba, hsl/hsla), conversões, composição de transparência e simulação de daltonismo.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';

export const WHITE = Object.freeze({ r: 255, g: 255, b: 255, a: 1 });
export const BLACK = Object.freeze({ r: 0, g: 0, b: 0, a: 1 });

function parseHex(text) {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (!m) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
  const n = (i) => parseInt(hex.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
}

// Divide os argumentos de rgb()/hsl() nas sintaxes antiga (vírgulas) e moderna (espaços e "/").
function splitArgs(inner) {
  const body = inner.trim();
  if (body.includes(',')) {
    if (body.includes('/')) return null;
    const parts = body.split(',').map((p) => p.trim());
    if (parts.some((p) => !p)) return null;
    return parts.length === 3 || parts.length === 4 ? parts : null;
  }
  const [main, alpha, extra] = body.split('/').map((p) => p.trim());
  if (extra !== undefined || alpha === '') return null;
  const parts = main.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return null;
  return alpha !== undefined ? [...parts, alpha] : parts;
}

function parseAlpha(token) {
  if (token === undefined) return 1;
  const m = new RegExp(`^(${NUMBER})(%?)$`, 'i').exec(token);
  if (!m) return null;
  const value = Number(m[1]) / (m[2] ? 100 : 1);
  return clamp(value, 0, 1);
}

function parseRgb(args) {
  const channels = args.slice(0, 3).map((token) => {
    const m = new RegExp(`^(${NUMBER})(%?)$`, 'i').exec(token);
    if (!m) return null;
    const value = m[2] ? (Number(m[1]) * 255) / 100 : Number(m[1]);
    return clamp(value, 0, 255);
  });
  const a = parseAlpha(args[3]);
  if (channels.includes(null) || a === null) return null;
  const [r, g, b] = channels.map(Math.round);
  return { r, g, b, a };
}

function parseHue(token) {
  const m = new RegExp(`^(${NUMBER})(deg|grad|rad|turn)?$`, 'i').exec(token);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] || 'deg').toLowerCase();
  const degrees = { deg: value, grad: value * 0.9, rad: (value * 180) / Math.PI, turn: value * 360 }[unit];
  return ((degrees % 360) + 360) % 360;
}

function parsePercent(token) {
  const m = new RegExp(`^(${NUMBER})(%?)$`, 'i').exec(token);
  return m ? clamp(Number(m[1]), 0, 100) / 100 : null;
}

// HSL → RGB (algoritmo da especificação CSS Color 4). h em graus; s e l de 0 a 1. Canais de 0 a 255, sem arredondar.
export function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return { r: f(0), g: f(8), b: f(4) };
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function parseHsl(args) {
  const h = parseHue(args[0]);
  const s = parsePercent(args[1]);
  const l = parsePercent(args[2]);
  const a = parseAlpha(args[3]);
  if (h === null || s === null || l === null || a === null) return null;
  const { r, g, b } = hslToRgb(h, s, l);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
}

// Retorna { r, g, b (inteiros de 0 a 255), a (de 0 a 1) } ou null se o texto não for uma cor reconhecida.
export function parseColor(input) {
  const text = String(input ?? '').trim().toLowerCase();
  if (!text) return null;
  const hex = parseHex(text);
  if (hex) return hex;
  const m = /^(rgba?|hsla?)\(\s*(.*?)\s*\)$/.exec(text);
  if (!m) return null;
  const args = splitArgs(m[2]);
  if (!args) return null;
  return m[1].startsWith('rgb') ? parseRgb(args) : parseHsl(args);
}

const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

export function toHex({ r, g, b, a = 1 }) {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a < 1 ? `${base}${hex2(a * 255)}` : base;
}

// Mistura uma cor com transparência sobre um fundo opaco (como o navegador desenha), arredondando para 8 bits.
export function composite(top, bottom) {
  const a = top.a ?? 1;
  const mix = (t, b) => Math.round(a * t + (1 - a) * b);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

// Cores efetivas do par: fundo transparente vai sobre branco; texto transparente vai sobre o fundo.
export function effectivePair(text, background) {
  const bg = (background.a ?? 1) < 1 ? composite(background, WHITE) : { ...background, a: 1 };
  const fg = (text.a ?? 1) < 1 ? composite(text, bg) : { ...text, a: 1 };
  return { text: fg, background: bg };
}

// Daltonismo: matrizes de Machado et al. (2009), severidade 1,0, aplicadas em RGB linear.
export const CVD_MATRICES = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

export function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function fromLinear(value) {
  const v = clamp(value, 0, 1);
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(c * 255);
}

export function simulate(color, type) {
  const matrix = CVD_MATRICES[type];
  if (!matrix) throw new Error(`Tipo de simulação desconhecido: ${type}`);
  const lin = [toLinear(color.r), toLinear(color.g), toLinear(color.b)];
  const [r, g, b] = matrix.map((row) => fromLinear(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
  return { r, g, b, a: 1 };
}
