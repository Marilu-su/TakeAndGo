import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCartLine, cartTotal, lineKey } from '../src/lib/cart.ts';
const base = { productId: 'p1', name: 'Producto', priceCents: 1029, quantity: 2, additions: [{ id: 'a1', name: 'Extra', priceCents: 15 }] };
test('carrito: totaliza cantidades y adicionales en centavos', () => assert.equal(cartTotal([base]), 2088));
test('carrito: combina la misma selección y separa variantes', () => {
  const lines = addCartLine([base], { ...base, quantity: 1 });
  assert.equal(lines[0].quantity, 3); assert.equal(base.quantity, 2);
  assert.equal(addCartLine(lines, { ...base, additions: [] }).length, 2);
});
test('carrito: orden de adicionales no duplica variantes', () => {
  const additions = [...base.additions, { id: 'a2', name: 'Otro', priceCents: 10 }];
  assert.equal(lineKey({ ...base, additions }), lineKey({ ...base, additions: additions.toReversed() }));
});
test('carrito: rechaza cantidades inválidas y desbordamientos', () => {
  for (const quantity of [0, -1, 1.5, Infinity]) assert.throws(() => addCartLine([], { ...base, quantity }));
  assert.throws(() => addCartLine([], { ...base, quantity: 2147483647 }));
});
