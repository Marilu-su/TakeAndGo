import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceCents } from '../src/lib/price.ts';
test('dinero: convierte pesos a centavos sin redondeo binario', () => {
  assert.equal(parsePriceCents('10,29'), 1029);
  assert.equal(parsePriceCents('0.01'), 1);
  assert.equal(parsePriceCents('12'), 1200);
  assert.equal(parsePriceCents('0'), 0);
});
test('dinero: rechaza negativos, precisión excesiva y desbordamiento', () => {
  for (const input of ['-1', '1.001', '', 'NaN', 'Infinity', '1e3', '21474836.48']) assert.throws(() => parsePriceCents(input));
});
