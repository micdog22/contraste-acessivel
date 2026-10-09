import { parseColor, toHex, simulate, composite, WHITE } from './color.js';
import { pairContrast, contrastRatio, evaluate, formatRatio, suggest, parsePalette, contrastMatrix, grade } from './contrast.js';

const $ = (id) => document.getElementById(id);
const textInput = $('text-color');
const bgInput = $('bg-color');
const textPicker = $('text-picker');
const bgPicker = $('bg-picker');
const notesEl = $('color-notes');
const ratioEl = $('ratio');
const ratioHint = $('ratio-hint');
const criteriaEl = $('criteria');
const preview = $('preview');
const suggestionsEl = $('suggestions');
const simEl = $('simulation');
const paletteInput = $('palette');
const paletteErrors = $('palette-errors');
const matrixWrap = $('matrix-wrap');

const STORAGE_KEY = 'contraste-acessivel:estado';
const DEFAULTS = {
  text: '#777777',
  background: '#ffffff',
  palette: 'Texto: #1b1f24\nFundo: #ffffff\nPrimária: #2563eb\nDestaque: #f59e0b\nSucesso: #16a34a\nCinza: #9ca3af',
};
const alphaFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const SIMULATIONS = [
  { type: null, title: 'Visão típica', detail: 'Referência' },
  { type: 'protanopia', title: 'Protanopia', detail: 'Sem os cones sensíveis ao vermelho' },
  { type: 'deuteranopia', title: 'Deuteranopia', detail: 'Sem os cones sensíveis ao verde' },
  { type: 'tritanopia', title: 'Tritanopia', detail: 'Sem os cones sensíveis ao azul' },
];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

function paint(node, fg, bg) {
  node.style.color = toHex(fg);
  node.style.backgroundColor = toHex(bg);
  return node;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: textInput.value, background: bgInput.value, palette: paletteInput.value }));
  } catch {
    // sem armazenamento: segue sem lembrar
  }
}

function renderCriteria(ratio) {
  criteriaEl.replaceChildren(...evaluate(ratio).map((c) => el('li', { class: c.pass ? 'pass' : 'fail' },
    el('span', {}, `${c.group} · ${c.level} (${String(c.min).replace('.', ',')}:1)`),
    el('span', { class: 'verdict' }, c.pass ? '✓ Passa' : '✗ Falha'))));
}

function renderSuggestions(text, background, ratio, pair) {
  const targets = [{ min: 4.5, label: 'AA (4,5:1)' }, { min: 7, label: 'AAA (7:1)' }].filter((t) => ratio < t.min);
  if (!targets.length) {
    suggestionsEl.replaceChildren(el('p', { class: 'all-good' }, 'Este par já atinge o nível AAA para texto normal. Nada a corrigir.'));
    return;
  }
  const groups = targets.map((target) => {
    const items = ['text', 'background'].map((adjust) => {
      const what = adjust === 'text' ? 'texto' : 'fundo';
      const s = suggest(text, background, target.min, adjust);
      if (!s) {
        return el('li', {}, el('div', { class: 'info' },
          el('strong', {}, `Mudando o ${what}`),
          el('span', { class: 'muted small' }, `Não dá para chegar a ${target.label} só mudando a luminosidade do ${what}.`)));
      }
      const shown = adjust === 'text' ? { fg: s.color, bg: pair.background } : { fg: pairContrast(text, s.color).text, bg: s.color };
      const swatch = paint(el('span', { class: 'swatch', 'aria-hidden': 'true' }, 'Aa'), shown.fg, shown.bg);
      const button = el('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Aplicar ${s.hex} como cor do ${what}` }, 'Aplicar');
      button.addEventListener('click', () => {
        (adjust === 'text' ? textInput : bgInput).value = s.hex;
        update();
      });
      return el('li', {}, swatch,
        el('div', { class: 'info' }, el('strong', {}, `Mudando o ${what}`), el('code', {}, s.hex), ` · ${formatRatio(s.ratio)}`),
        button);
    });
    return el('div', { class: 'suggest-group' }, el('h3', {}, `Para ${target.label}`), el('ul', { class: 'suggest-list' }, ...items));
  });
  suggestionsEl.replaceChildren(...groups);
}

function renderSimulation(pair) {
  simEl.replaceChildren(...SIMULATIONS.map((sim) => {
    const fg = sim.type ? simulate(pair.text, sim.type) : pair.text;
    const bg = sim.type ? simulate(pair.background, sim.type) : pair.background;
    const sample = paint(el('div', { class: 'sim-sample' }, 'Texto de exemplo', el('small', {}, 'Acessibilidade é para todos.')), fg, bg);
    return el('div', { class: 'sim-card' }, sample,
      el('div', { class: 'sim-info' }, el('strong', {}, sim.title), `${sim.detail} · contraste aproximado ${formatRatio(contrastRatio(fg, bg))}`));
  }));
}

function update() {
  const text = parseColor(textInput.value);
  const background = parseColor(bgInput.value);
  textInput.setAttribute('aria-invalid', String(!text));
  bgInput.setAttribute('aria-invalid', String(!background));
  const notes = [];
  const formats = 'Use #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl() ou hsla().';
  if (!text) notes.push(el('p', { class: 'error' }, `Não reconheci a cor do texto. ${formats}`));
  if (!background) notes.push(el('p', { class: 'error' }, `Não reconheci a cor do fundo. ${formats}`));

  if (!text || !background) {
    notesEl.replaceChildren(...notes);
    ratioEl.textContent = '-';
    ratioHint.textContent = 'Corrija as cores acima para ver o resultado.';
    criteriaEl.replaceChildren();
    suggestionsEl.replaceChildren();
    simEl.replaceChildren();
    return;
  }

  textPicker.value = toHex({ ...text, a: 1 });
  bgPicker.value = toHex({ ...background, a: 1 });
  const result = pairContrast(text, background);
  if (background.a < 1) {
    notes.push(el('p', {}, `O fundo tem transparência (alfa ${alphaFormat.format(background.a)}). Considerado sobre branco, ele fica ${toHex(result.background)}.`));
  }
  if (text.a < 1) {
    notes.push(el('p', {}, `O texto tem transparência (alfa ${alphaFormat.format(text.a)}). Combinado com o fundo, ele fica ${toHex(result.text)}.`));
  }
  notesEl.replaceChildren(...notes);

  ratioEl.textContent = formatRatio(result.ratio);
  ratioHint.textContent = `Texto ${toHex(result.text)} sobre fundo ${toHex(result.background)}.`;
  renderCriteria(result.ratio);
  preview.style.setProperty('--sample-fg', toHex(result.text));
  preview.style.setProperty('--sample-bg', toHex(result.background));
  renderSuggestions(text, background, result.ratio, result);
  renderSimulation(result);
  saveState();
}

function renderPalette() {
  const { colors, errors } = parsePalette(paletteInput.value);
  paletteErrors.replaceChildren(...errors.map((e) => el('p', { class: 'error' }, e)));
  if (colors.length < 2) {
    matrixWrap.replaceChildren(el('p', { class: 'muted' }, 'Informe pelo menos duas cores para montar a matriz.'));
    return;
  }
  const matrix = contrastMatrix(colors);
  const chip = (color) => {
    const node = el('span', { class: 'chip', 'aria-hidden': 'true' });
    node.style.backgroundColor = toHex(composite(color, WHITE));
    return node;
  };
  const head = el('tr', {}, el('th', { scope: 'col' }, el('span', { class: 'visually-hidden' }, 'Texto (linhas) sobre fundo (colunas)')),
    ...colors.map((c) => el('th', { scope: 'col' }, chip(c.color), c.label)));
  const rows = colors.map((fg, i) => el('tr', {}, el('th', { scope: 'row', class: 'row-head' }, chip(fg.color), fg.label),
    ...colors.map((bg, j) => {
      const ratio = matrix[i][j];
      if (ratio === null) return el('td', { class: 'same' }, el('span', { class: 'cell-info' }, '-'));
      const g = grade(ratio);
      const cls = { AAA: 'g-aaa', AA: 'g-aa', 'AA grande': 'g-large', Falha: 'g-fail' }[g];
      const pair = pairContrast(fg.color, bg.color);
      const sample = paint(el('span', { class: 'cell-sample', 'aria-hidden': 'true' }, 'Aa'), pair.text, pair.background);
      return el('td', { class: cls }, sample, el('span', { class: 'cell-info' }, `${formatRatio(ratio)} · ${g}`));
    })));
  const table = el('table', { class: 'matrix' },
    el('caption', { class: 'visually-hidden' }, 'Contraste de cada cor de texto (linhas) sobre cada cor de fundo (colunas)'),
    el('thead', {}, head), el('tbody', {}, ...rows));
  matrixWrap.replaceChildren(table);
}

textInput.addEventListener('input', update);
bgInput.addEventListener('input', update);
textPicker.addEventListener('input', () => {
  textInput.value = textPicker.value;
  update();
});
bgPicker.addEventListener('input', () => {
  bgInput.value = bgPicker.value;
  update();
});
$('swap').addEventListener('click', () => {
  [textInput.value, bgInput.value] = [bgInput.value, textInput.value];
  update();
});
paletteInput.addEventListener('input', () => {
  renderPalette();
  saveState();
});

const state = loadState();
textInput.value = state.text;
bgInput.value = state.background;
paletteInput.value = state.palette;
update();
renderPalette();
