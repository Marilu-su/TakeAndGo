import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ExpireReservationsJob, LATE_PAYMENT_LOOKBACK_MS } from '../../../src/modules/payment/application/expireReservationsJob';
import type { Payment } from '../../../src/modules/payment/domain/payment';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const payment = (id: string) => ({ id, status: 'PENDING' }) as Payment;

test('proceso de vencimiento: vence reservas y revisa los pagos de pedidos recién vencidos', async () => {
  const calls: string[] = [];
  let window: [Date, Date] | undefined;

  const job = new ExpireReservationsJob(
    { execute: async now => { calls.push(`vencer ${now.toISOString()}`); return { releasedOrdersCount: 2 }; } },
    async (since, now) => { window = [since, now]; return [payment('p1'), payment('p2')]; },
    { reconcileExpired: async p => { calls.push(`revisar ${p.id}`); } },
    () => NOW,
  );

  const result = await job.run();

  assert.deepEqual(calls, [`vencer ${NOW.toISOString()}`, 'revisar p1', 'revisar p2']);
  assert.deepEqual(result, { releasedOrdersCount: 2, reviewedPaymentsCount: 2 });
  assert.equal(window![1], NOW);
  assert.equal(NOW.getTime() - window![0].getTime(), LATE_PAYMENT_LOOKBACK_MS);
});

test('proceso de vencimiento: si falla la revisión de un pago, sigue con los demás', async () => {
  const reviewed: string[] = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    const job = new ExpireReservationsJob(
      { execute: async () => ({ releasedOrdersCount: 0 }) },
      async () => [payment('p1'), payment('p2')],
      {
        reconcileExpired: async p => {
          reviewed.push(p.id);
          if (p.id === 'p1') throw new Error('Mercado Pago no respondió');
        },
      },
      () => NOW,
    );

    await job.run();
    assert.deepEqual(reviewed, ['p1', 'p2']);
  } finally {
    console.error = originalError;
  }
});
