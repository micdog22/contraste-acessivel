import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, toHex, composite, effectivePair, hslToRgb, rgbToHsl, simulate, toLinear, fromLinear, WHITE } from '../src/color.js';

const rgb = (r, g, b, a = 1) => ({ r, g, b, a });

test('hexadecimal: #rgb, #rgba, #rrggbb e #rrggbbaa (com ou sem #)', () => {
  assert.deepEqual(parseColor('#fff'), rgb(255, 255, 255));
  assert.deepEqual(parseColor('#ABC'), rgb(0xaa, 0xbb, 0xcc));
  assert.deepEqual(parseColor('777777'), rgb(0x77, 0x77, 0x77));
  assert.deepEqual(parseColor(' #2563EB '), rgb(0x25, 0x63, 0xeb));
  assert.deepEqual(parseColor('#00000080'), rgb(0, 0, 0, 128 / 255));
  assert.deepEqual(parseColor('#0f08'), rgb(0, 255, 0, 0x88 / 255));
  for (const bad of ['#12345', '#1234567', '#ggg', '#', '', 'azul', '12']) assert.equal(parseColor(bad), null, bad);
});

test('rgb() e rgba() nas sintaxes antiga e moderna', () => {
  assert.deepEqual(parseColor('rgb(255, 0, 0)'), rgb(255, 0, 0));
  assert.deepEqual(parseColor('RGBA(255,0,0,0.5)'), rgb(255, 0, 0, 0.5));
  assert.deepEqual(parseColor('rgb(255 0 0 / 50%)'), rgb(255, 0, 0, 0.5));
  assert.deepEqual(parseColor('rgba(10 20 30)'), rgb(10, 20, 30));
  assert.deepEqual(parseColor('rgb(100%, 50%, 0%)'), rgb(255, 128, 0));
  assert.deepEqual(parseColor('rgb(127.5, 0, 0)'), rgb(128, 0, 0));
  assert.deepEqual(parseColor('rgb(300, -5, 0, 2)'), rgb(255, 0, 0, 1));
  assert.deepEqual(parseColor('rgb(1e2, 0, 0, .25)'), rgb(100, 0, 0, 0.25));
  for (const bad of ['rgb(1,2)', 'rgb(1,2,3,4,5)', 'rgb(1 2 3 / )', 'rgb(1, 2 3)', 'rgb(1,2,3 / 1)', 'rgb()', 'rgb(a,b,c)', 'rgb(1 2 3 / 1 / 2)']) {
    assert.equal(parseColor(bad), null, bad);
  }
});

test('hsl() e hsla() com unidades de matiz', () => {
  assert.deepEqual(parseColor('hsl(0, 100%, 50%)'), rgb(255, 0, 0));
  assert.deepEqual(parseColor('hsl(120deg 100% 25%)'), rgb(0, 128, 0));
  assert.deepEqual(parseColor('hsla(240, 100%, 50%, .25)'), rgb(0, 0, 255, 0.25));
  assert.deepEqual(parseColor('hsl(0.5turn 100% 50%)'), rgb(0, 255, 255));
  assert.deepEqual(parseColor('hsl(200grad 100% 50%)'), rgb(0, 255, 255));
  assert.deepEqual(parseColor('hsl(3.14159265rad 100% 50%)'), rgb(0, 255, 255));
  assert.deepEqual(parseColor('hsl(-120, 100%, 50%)'), rgb(0, 0, 255));
  assert.deepEqual(parseColor('hsl(210 40 50 / 30%)'), { ...parseColor('hsl(210, 40%, 50%)'), a: 0.3 });
  assert.deepEqual(parseColor('hsl(0, 0%, 100%)'), rgb(255, 255, 255));
  for (const bad of ['hsl(10, 20%)', 'hsl(10px, 20%, 30%)', 'hsla(1,2%,3%,x)']) assert.equal(parseColor(bad), null, bad);
});

test('conversões RGB ↔ HSL', () => {
  assert.deepEqual(rgbToHsl(rgb(255, 0, 0)), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(rgbToHsl(rgb(119, 119, 119)), { h: 0, s: 0, l: 119 / 255 });
  const { h, s, l } = rgbToHsl(rgb(0x25, 0x63, 0xeb));
  const back = hslToRgb(h, s, l);
  assert.ok(Math.abs(back.r - 0x25) < 1e-9 && Math.abs(back.g - 0x63) < 1e-9 && Math.abs(back.b - 0xeb) < 1e-9);
});

test('toHex com e sem transparência', () => {
  assert.equal(toHex(rgb(37, 99, 235)), '#2563eb');
  assert.equal(toHex(rgb(0, 0, 0, 0.5)), '#00000080');
});

test('composição de transparência', () => {
  assert.deepEqual(composite(parseColor('#00000080'), WHITE), rgb(127, 127, 127));
  assert.deepEqual(composite(rgb(255, 0, 0, 0.5), rgb(0, 0, 255)), rgb(128, 0, 128));
  assert.deepEqual(composite(rgb(10, 20, 30, 0), rgb(1, 2, 3)), rgb(1, 2, 3));
  const pair = effectivePair(rgb(255, 255, 255, 0.5), rgb(0, 0, 0, 0.5));
  assert.deepEqual(pair.background, rgb(128, 128, 128));
  assert.deepEqual(pair.text, rgb(192, 192, 192));
});

test('linearização sRGB nos dois lados do limite 0,04045', () => {
  assert.equal(toLinear(10), 10 / 255 / 12.92);
  assert.ok(Math.abs(toLinear(11) - ((11 / 255 + 0.055) / 1.055) ** 2.4) < 1e-15);
  for (let c = 0; c <= 255; c++) assert.equal(fromLinear(toLinear(c)), c);
});

test('simulação de daltonismo (Machado et al. 2009, severidade 1,0)', () => {
  for (const type of ['protanopia', 'deuteranopia', 'tritanopia']) {
    assert.deepEqual(simulate(rgb(255, 255, 255), type), rgb(255, 255, 255), type);
    assert.deepEqual(simulate(rgb(0, 0, 0), type), rgb(0, 0, 0), type);
    const gray = simulate(rgb(119, 119, 119), type);
    assert.ok([gray.r, gray.g, gray.b].every((c) => Math.abs(c - 119) <= 1), type);
  }
  assert.deepEqual(simulate(rgb(255, 0, 0), 'protanopia'), rgb(109, 95, 0));
  assert.deepEqual(simulate(rgb(255, 0, 0), 'deuteranopia'), rgb(163, 144, 0));
  assert.deepEqual(simulate(rgb(0, 0, 255), 'tritanopia'), rgb(0, 107, 150));
  assert.throws(() => simulate(rgb(0, 0, 0), 'outro'), /desconhecido/);
});
