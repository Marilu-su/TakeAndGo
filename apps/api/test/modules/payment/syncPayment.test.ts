import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SyncPaymentUseCase } from '../../../src/modules/payment/application/syncPaymentUseCase';
import { HandlePaymentNotificationUseCase } from '../../../src/modules/payment/application/handlePaymentNotificationUseCase';
import type { PaymentResult } from '../../../src/modules/payment/application/processPaymentResultUseCase';
import type { PaymentStatusPort, ProviderPayment } from '../../../src/modules/payment/domain/paymentStatusPort';
import { FakePaymentRepository } from '../../support/fakePaymentRepository';

const EXPIRES = new Date(Date.now() + 5 * 60_000);

class FakeStatusPort implements PaymentStatusPort {
  byId = new Map<string, ProviderPayment>();
  byReference = new Map<string, ProviderPayment>();
  async getPayment(id: string) { return this.byId.get(id) ?? null; }
  async findPaymentByReference(payment: { id: string }) { return this.byReference.get(payment.id) ?? null; }
}

async function setup(failWith?: string) {
  const repository = new FakePaymentRepository();
  const status = new FakeStatusPort();
  const applied: Array<{ paymentId: string; result: PaymentResult }> = [];

  // Simula el adaptador real: solo aplica pagos pendientes, igual que la transacción en PostgreSQL.
  const processResult = {
    async execute(paymentId: string, result: PaymentResult) {
      if (failWith) throw new Error(failWith);
      const updated = await repository.transitionStatus(paymentId, 'PENDING', result);
      if (!updated) throw new Error('PAYMENT_STATE_CONFLICT');
      applied.push({ paymentId, result });
      return updated;
    },
  };

  const sync = new SyncPaymentUseCase(repository, status, processResult);
  const webhook = new HandlePaymentNotificationUseCase(status, repository, sync);
  const payment = await repository.create({ orderId: 'order-1', amountCents: 230000, expiresAt: EXPIRES });

  const provider = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
    providerPaymentId: 'mp-1',
    externalReference: payment.id,
    status: 'APPROVED',
    amountCents: 230000,
    ...overrides,
  });

  return { repository, status, applied, sync, webhook, payment, provider };
}

test('sincronización: un pago aprobado en el proveedor confirma una sola vez', async () => {
  const { sync, status, payment, applied, repository, provider } = await setup();
  status.byReference.set(payment.id, provider());

  await sync.syncPending(payment);
  await sync.syncPending((await repository.findById(payment.id))!);

  assert.deepEqual(applied, [{ paymentId: payment.id, result: 'APPROVED' }]);
  const saved = await repository.findById(payment.id);
  assert.equal(saved?.status, 'APPROVED');
  assert.equal(saved?.providerPaymentId, 'mp-1');
});

test('sincronización: sin resultado definitivo el pago sigue pendiente', async () => {
  const { sync, status, payment, applied, provider } = await setup();

  await sync.syncPending(payment);
  status.byReference.set(payment.id, provider({ status: 'PENDING' }));
  await sync.syncPending(payment);

  assert.equal(applied.length, 0);
  assert.equal(payment.status, 'PENDING');
});

test('sincronización: al volver del checkout, un rechazo cancela el pedido', async () => {
  const { sync, status, payment, applied, provider } = await setup();
  status.byReference.set(payment.id, provider({ status: 'REJECTED' }));

  await sync.syncPending(payment);

  assert.deepEqual(applied, [{ paymentId: payment.id, result: 'REJECTED' }]);
});

test('sincronización: no aplica un pago con un monto distinto al del pedido', async () => {
  const { sync, status, payment, applied, provider } = await setup();
  status.byReference.set(payment.id, provider({ amountCents: 1 }));
  const originalError = console.error;
  console.error = () => {};

  try {
    await sync.syncPending(payment);
  } finally {
    console.error = originalError;
  }

  assert.equal(applied.length, 0);
});

test('sincronización: una aprobación tardía no rompe la consulta ni confirma el pedido', async () => {
  const { sync, status, payment, provider, repository } = await setup('ORDER_NOT_RESERVED');
  status.byReference.set(payment.id, provider());
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await sync.syncPending(payment);
  } finally {
    console.warn = originalWarn;
  }

  const saved = await repository.findById(payment.id);
  assert.equal(saved?.status, 'PENDING');
  // Se guarda el id del pago real para poder reembolsarlo (MVP-08).
  assert.equal(saved?.providerPaymentId, 'mp-1');
});

test('sincronización: otros errores se propagan', async () => {
  const { sync, status, payment, provider } = await setup('STOCK_RESERVATION_CONFLICT');
  status.byReference.set(payment.id, provider());

  await assert.rejects(sync.syncPending(payment), /STOCK_RESERVATION_CONFLICT/);
});

test('aviso: confirma el pedido consultando el pago real, y los avisos repetidos no hacen nada', async () => {
  const { webhook, status, payment, applied, provider } = await setup();
  status.byId.set('mp-1', provider());

  await webhook.execute('mp-1');
  await webhook.execute('mp-1');
  await webhook.execute('mp-1');

  assert.deepEqual(applied, [{ paymentId: payment.id, result: 'APPROVED' }]);
});

test('aviso: avisos simultáneos confirman una sola vez', async () => {
  const { webhook, status, payment, applied, provider, sync } = await setup();
  status.byId.set('mp-1', provider());
  status.byReference.set(payment.id, provider());

  await Promise.all([webhook.execute('mp-1'), webhook.execute('mp-1'), sync.syncPending(payment)]);

  assert.equal(applied.length, 1);
});

test('aviso: un rechazo no cancela mientras el cliente puede reintentar en el checkout', async () => {
  const { webhook, status, applied, provider } = await setup();
  status.byId.set('mp-1', provider({ status: 'REJECTED' }));

  await webhook.execute('mp-1');

  assert.equal(applied.length, 0);
});

test('aviso: ignora pagos desconocidos o de otros sistemas', async () => {
  const { webhook, status, applied, provider } = await setup();
  status.byId.set('ajeno', provider({ providerPaymentId: 'ajeno', externalReference: 'otro-sistema' }));
  status.byId.set('sin-ref', provider({ providerPaymentId: 'sin-ref', externalReference: null }));

  await webhook.execute('no-existe');
  await webhook.execute('ajeno');
  await webhook.execute('sin-ref');

  assert.equal(applied.length, 0);
});

test('pago vencido: si se aprobó tarde, se procesa para reembolsarlo', async () => {
  const { sync, status, payment, applied, provider } = await setup();
  status.byReference.set(payment.id, provider());

  await sync.reconcileExpired(payment);

  assert.deepEqual(applied, [{ paymentId: payment.id, result: 'APPROVED' }]);
});

test('pago vencido: un rechazo o un pago sin resultado no hacen nada', async () => {
  const { sync, status, payment, applied, provider } = await setup();

  await sync.reconcileExpired(payment);
  status.byReference.set(payment.id, provider({ status: 'REJECTED' }));
  await sync.reconcileExpired(payment);

  assert.equal(applied.length, 0);
});

test('sincronización: el reembolso de un pago tardío no rompe la consulta', async () => {
  const { sync, status, payment, provider } = await setup('LATE_PAYMENT_COMPENSATED');
  status.byReference.set(payment.id, provider());
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (message: string) => { warnings.push(message); };

  try {
    await sync.syncPending(payment);
  } finally {
    console.warn = originalWarn;
  }

  assert.match(warnings[0], /se reembolsó/);
});

test('sincronización: un rechazo de un pedido ya vencido se ignora sin errores', async () => {
  const { sync, status, payment, provider } = await setup('ORDER_NOT_RESERVED');
  status.byReference.set(payment.id, provider({ status: 'REJECTED' }));
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };

  try {
    await sync.syncPending(payment);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warned, false);
});

test('sincronización: aprobación tardía antes de que venza el pedido queda para el proceso periódico', async () => {
  const { sync, status, payment, provider } = await setup('ORDER_NOT_EXPIRED');
  status.byReference.set(payment.id, provider());
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await sync.syncPending(payment);
  } finally {
    console.warn = originalWarn;
  }
});
