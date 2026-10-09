import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, rgbToHsl, WHITE, BLACK } from '../src/color.js';
import {
  relativeLuminance, contrastRatio, pairContrast, evaluate, formatRatio, grade, suggest, parsePalette, contrastMatrix,
} from '../src/contrast.js';

const c = (text) => parseColor(text);
const close = (actual, expected, eps = 1e-3) => assert.ok(Math.abs(actual - expected) < eps, `${actual} ≠ ${expected}`);

test('luminância relativa', () => {
  assert.equal(relativeLuminance(WHITE), 1);
  assert.equal(relativeLuminance(BLACK), 0);
  close(relativeLuminance(c('#808080')), 0.2159, 1e-4);
  close(relativeLuminance(c('#ff0000')), 0.2126, 1e-9);
  close(relativeLuminance(c('#00ff00')), 0.7152, 1e-9);
  close(relativeLuminance(c('#0000ff')), 0.0722, 1e-9);
});

test('preto e branco = 21:1; a ordem não importa', () => {
  assert.equal(contrastRatio(BLACK, WHITE), 21);
  assert.equal(contrastRatio(WHITE, BLACK), 21);
  assert.equal(contrastRatio(c('#777'), c('#777')), 1);
  assert.equal(formatRatio(21), '21,00:1');
});

test('#777777 sobre branco ≈ 4,48 (reprova AA); #767676 ≈ 4,54 (aprova)', () => {
  const r777 = contrastRatio(c('#777777'), WHITE);
  close(r777, 4.478, 1e-3);
  assert.equal(formatRatio(r777), '4,48:1');
  assert.deepEqual(evaluate(r777).map((x) => [x.id, x.pass]), [
    ['normal-aa', false], ['normal-aaa', false], ['large-aa', true], ['large-aaa', false], ['ui', true],
  ]);
  const r767 = contrastRatio(c('#767676'), WHITE);
  close(r767, 4.542, 1e-3);
  assert.equal(formatRatio(r767), '4,54:1');
  assert.equal(evaluate(r767).find((x) => x.id === 'normal-aa').pass, true);
});

test('formatRatio nunca arredonda para cima até um limite que não foi atingido', () => {
  assert.equal(formatRatio(4.4996), '4,49:1');
  assert.equal(formatRatio(6.996), '6,99:1');
  assert.equal(formatRatio(2.999), '2,99:1');
  assert.equal(formatRatio(4.5), '4,50:1');
  assert.equal(formatRatio(5.678), '5,68:1');
  assert.equal(formatRatio(1), '1,00:1');
});

test('critérios WCAG e classificação curta', () => {
  assert.deepEqual(evaluate(7).map((x) => x.pass), [true, true, true, true, true]);
  assert.deepEqual(evaluate(2.9).map((x) => x.pass), [false, false, false, false, false]);
  assert.equal(grade(7.1), 'AAA');
  assert.equal(grade(4.5), 'AA');
  assert.equal(grade(3), 'AA grande');
  assert.equal(grade(2.99), 'Falha');
});

test('contraste com transparência: texto sobre o fundo, fundo sobre branco', () => {
  const half = pairContrast(c('#00000080'), WHITE);
  assert.deepEqual(half.text, { r: 127, g: 127, b: 127, a: 1 });
  close(half.ratio, contrastRatio(c('#7f7f7f'), WHITE), 1e-12);
  const bgAlpha = pairContrast(c('#000'), c('rgba(0, 0, 0, 0.5)'));
  assert.deepEqual(bgAlpha.background, { r: 128, g: 128, b: 128, a: 1 });
});

test('sugestões chegam ao alvo e são as mais próximas', () => {
  const aa = suggest(c('#777777'), WHITE, 4.5, 'text');
  assert.equal(aa.hex, '#767676');
  assert.ok(aa.ratio >= 4.5);
  const aaa = suggest(c('#777777'), WHITE, 7, 'text');
  assert.equal(aaa.hex, '#595959');
  assert.ok(aaa.ratio >= 7);
  assert.ok(contrastRatio(c('#5a5a5a'), WHITE) < 7);
  const bg = suggest(c('#777777'), WHITE, 4.5, 'background');
  assert.equal(bg.hex, '#060606');
  assert.ok(contrastRatio(c('#777777'), c('#070707')) < 4.5);
});

test('sugestão impossível retorna null; par que já passa volta igual', () => {
  assert.equal(suggest(c('#ffffff'), c('#777777'), 7, 'text'), null);
  const same = suggest(c('#000'), WHITE, 7, 'text');
  assert.equal(same.hex, '#000000');
  assert.equal(same.delta, 0);
});

test('sugestões mantêm matiz e saturação e funcionam com cores variadas', () => {
  const pairs = [
    ['#2563eb', '#1e3a8a'], ['#f59e0b', '#ffffff'], ['#16a34a', '#f0fdf4'], ['#e11d48', '#111827'],
    ['#7c3aed', '#6d28d9'], ['rgba(37, 99, 235, 0.6)', '#ffffff'], ['#1b1f24', 'rgba(0,0,0,0.7)'],
  ];
  for (const [fg, bg] of pairs) {
    for (const target of [4.5, 7]) {
      for (const adjust of ['text', 'background']) {
        const s = suggest(c(fg), c(bg), target, adjust);
        if (!s) continue;
        assert.ok(s.ratio >= target, `${fg} / ${bg} ${adjust} ${target}`);
        const recomputed = adjust === 'text' ? pairContrast(s.color, c(bg)).ratio : pairContrast(c(fg), s.color).ratio;
        assert.ok(recomputed >= target, `recalculado ${fg} / ${bg} ${adjust} ${target}`);
        const before = rgbToHsl(adjust === 'text' ? pairContrast(c(fg), c(bg)).text : pairContrast(c(fg), c(bg)).background);
        const after = rgbToHsl(s.color);
        if (after.s > 0.2 && after.l > 0.1 && after.l < 0.9) assert.ok(Math.abs(after.h - before.h) < 6, `matiz ${fg} ${bg}`);
      }
    }
  }
  // Ao menos uma das duas opções sempre existe para AA quando um dos lados pode ir a preto ou branco
  assert.ok(suggest(c('#2563eb'), c('#1e3a8a'), 4.5, 'text'));
});

test('paleta: rótulos, várias cores por linha e erros', () => {
  const { colors, errors } = parsePalette('Texto: #1b1f24\nFundo = #ffffff\n#2563eb, rgb(255 0 0 / 50%)\nlinha sem cor\n#12345\n\n');
  assert.deepEqual(colors.map((x) => x.label), ['Texto', 'Fundo', '#2563eb', 'rgb(255 0 0 / 50%)']);
  assert.deepEqual(errors, ['Linha 4: nenhuma cor encontrada.', 'Linha 5: «#12345» não é uma cor válida.']);
  const many = parsePalette(Array.from({ length: 25 }, (_, i) => `#${String(i).padStart(2, '0')}0000`).join('\n'));
  assert.equal(many.colors.length, 20);
  assert.match(many.errors[0], /no máximo 20/);
});

test('matriz de contraste', () => {
  const { colors } = parsePalette('#ffffff\n#000000\n#777777\n#00000080');
  const m = contrastMatrix(colors);
  assert.equal(m[0][0], null);
  assert.equal(m[0][1], 21);
  assert.equal(m[1][0], 21);
  close(m[2][0], 4.478);
  close(m[0][2], 4.478);
  close(m[3][0], contrastRatio(c('#7f7f7f'), WHITE), 1e-12);
  assert.equal(m.length, 4);
  assert.ok(m.every((row) => row.length === 4));
});
