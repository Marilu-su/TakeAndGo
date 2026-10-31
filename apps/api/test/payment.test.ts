
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakePaymentPort } from './support/fakePaymentPort';
import { CreatePaymentUseCase } from '../src/modules/payment/application/createPaymentUseCase';
import { FakePaymentRepository } from './support/fakePaymentRepository';
import { canTransitionPayment } from '../src/modules/payment/domain/payment';
import { ResolvePaymentUseCase } from '../src/modules/payment/application/resolvePaymentUseCase';


test('permite aprobar un pago pendiente', () => {
  assert.equal(
    canTransitionPayment('PENDING', 'APPROVED'),
    true,
  );
});

test('permite rechazar un pago pendiente', () => {
  assert.equal(
    canTransitionPayment('PENDING', 'REJECTED'),
    true,
  );
});

test('permite reembolsar un pago aprobado', () => {
  assert.equal(
    canTransitionPayment('APPROVED', 'REFUNDED'),
    true,
  );
});

test('no permite aprobar un pago rechazado', () => {
  assert.equal(
    canTransitionPayment('REJECTED', 'APPROVED'),
    false,
  );
});

test('no permite modificar un pago reembolsado', () => {
  assert.equal(
    canTransitionPayment('REFUNDED', 'PENDING'),
    false,
  );
});

test('no permite repetir una transición de estado', () => {
  assert.equal(
    canTransitionPayment('APPROVED', 'APPROVED'),
    false,
  );
});

test('crea una intención de pago simulada', async () => {
  const paymentPort = new FakePaymentPort();

  const result = await paymentPort.createPaymentIntent({
    paymentId: 'payment-123',
    amountCents: 500000,
    expiresAt: new Date('2026-11-01T15:00:00Z'),
  });

  assert.equal(
    result.providerPaymentId,
    'fake-payment-123',
  );
});

test('registra las solicitudes enviadas al simulador', async () => {
  const paymentPort = new FakePaymentPort();

  const input = {
    paymentId: 'payment-456',
    amountCents: 250000,
    expiresAt: new Date('2026-11-01T15:00:00Z'),
  };

  await paymentPort.createPaymentIntent(input);

  assert.equal(paymentPort.createdIntents.length, 1);
  assert.deepEqual(paymentPort.createdIntents[0], input);
});

test('crea un pago pendiente e inicia la intención de pago', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const payment = await useCase.execute(
    'order-123',
    500000,
    expiresAt,
  );

  assert.equal(payment.status, 'PENDING');
  assert.equal(payment.orderId, 'order-123');
  assert.equal(payment.amountCents, 500000);
  assert.equal(payment.providerPaymentId, 'fake-payment-1');
  assert.equal(port.createdIntents.length, 1);
});

test('no crea dos pagos al repetir la solicitud', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const first = await useCase.execute('order-123', 500000, expiresAt);
  const second = await useCase.execute('order-123', 500000, expiresAt);

  assert.equal(first.id, second.id);
  assert.equal(port.createdIntents.length, 1);
});

test('rechaza importes inválidos', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await assert.rejects(
    useCase.execute('order-123', -100, expiresAt),
    /monto del pago es inválido/,
  );

  assert.equal(port.createdIntents.length, 0);
});

test('guarda la referencia del proveedor al crear el pago', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const payment = await useCase.execute(
    'order-789',
    300000,
    new Date(Date.now() + 5 * 60 * 1000),
  );

  const savedPayment = await repository.findById(payment.id);

  assert.ok(savedPayment);
  assert.equal(
    savedPayment.providerPaymentId,
    'fake-payment-1',
  );
});

test('aprueba un pago pendiente', async () => {
  const repository = new FakePaymentRepository();
  const useCase = new ResolvePaymentUseCase(repository);

  const payment = await repository.create({
    orderId: 'order-1',
    amountCents: 500000,
    expiresAt: new Date(Date.now() + 300000),
  });

  const approved = await useCase.execute(payment.id, 'APPROVED');

  assert.equal(approved.status, 'APPROVED');

  const saved = await repository.findById(payment.id);
  assert.equal(saved?.status, 'APPROVED');
});

test('rechaza un pago pendiente', async () => {
  const repository = new FakePaymentRepository();
  const useCase = new ResolvePaymentUseCase(repository);

  const payment = await repository.create({
    orderId: 'order-2',
    amountCents: 250000,
    expiresAt: new Date(Date.now() + 300000),
  });

  const rejected = await useCase.execute(payment.id, 'REJECTED');

  assert.equal(rejected.status, 'REJECTED');
});

test('no permite aprobar un pago rechazado', async () => {
  const repository = new FakePaymentRepository();
  const useCase = new ResolvePaymentUseCase(repository);

  const payment = await repository.create({
    orderId: 'order-3',
    amountCents: 100000,
    expiresAt: new Date(Date.now() + 300000),
  });

  await useCase.execute(payment.id, 'REJECTED');

  await assert.rejects(
    useCase.execute(payment.id, 'APPROVED'),
    /Transición de pago inválida/,
  );
});

test('procesar dos veces una aprobación mantiene el estado', async () => {
  const repository = new FakePaymentRepository();
  const useCase = new ResolvePaymentUseCase(repository);

  const payment = await repository.create({
    orderId: 'order-4',
    amountCents: 150000,
    expiresAt: new Date(Date.now() + 300000),
  });

  const first = await useCase.execute(payment.id, 'APPROVED');
  const second = await useCase.execute(payment.id, 'APPROVED');

  assert.equal(first.id, second.id);
  assert.equal(second.status, 'APPROVED');
});

test('una transición condicional no sobrescribe otro estado', async () => {
  const repository = new FakePaymentRepository();

  const payment = await repository.create({
    orderId: 'order-5',
    amountCents: 200000,
    expiresAt: new Date(Date.now() + 300000),
  });

  await repository.transitionStatus(
    payment.id,
    'PENDING',
    'APPROVED',
  );

  const result = await repository.transitionStatus(
    payment.id,
    'PENDING',
    'REJECTED',
  );

  assert.equal(result, null);

  const saved = await repository.findById(payment.id);
  assert.equal(saved?.status, 'APPROVED');
});

test('no aprueba un pago vencido', async () => {
  const repository = new FakePaymentRepository();

  const now = new Date('2026-10-31T15:10:00Z');

  const useCase = new ResolvePaymentUseCase(
    repository,
    () => now,
  );

  const payment = await repository.create({
    orderId: 'order-expired',
    amountCents: 500000,
    expiresAt: new Date('2026-10-31T15:05:00Z'),
  });

  await assert.rejects(
    useCase.execute(payment.id, 'APPROVED'),
    /PAYMENT_EXPIRED/,
  );

  const saved = await repository.findById(payment.id);

  assert.equal(saved?.status, 'PENDING');
});

test('permite aprobar antes de la expiración', async () => {
  const repository = new FakePaymentRepository();

  const now = new Date('2026-10-31T15:04:59Z');

  const useCase = new ResolvePaymentUseCase(
    repository,
    () => now,
  );

  const payment = await repository.create({
    orderId: 'order-valid',
    amountCents: 500000,
    expiresAt: new Date('2026-10-31T15:05:00Z'),
  });

  const approved = await useCase.execute(
    payment.id,
    'APPROVED',
  );

  assert.equal(approved.status, 'APPROVED');
});

test('rechaza aprobación en el instante exacto del vencimiento', async () => {
  const repository = new FakePaymentRepository();

  const expiresAt = new Date('2026-10-31T15:05:00Z');

  const useCase = new ResolvePaymentUseCase(
    repository,
    () => expiresAt,
  );

  const payment = await repository.create({
    orderId: 'order-limit',
    amountCents: 100000,
    expiresAt,
  });

  await assert.rejects(
    useCase.execute(payment.id, 'APPROVED'),
    /PAYMENT_EXPIRED/,
  );
});

test('permite rechazar un pago pendiente vencido', async () => {
  const repository = new FakePaymentRepository();

  const now = new Date('2026-10-31T15:10:00Z');

  const useCase = new ResolvePaymentUseCase(
    repository,
    () => now,
  );

  const payment = await repository.create({
    orderId: 'order-expired-rejected',
    amountCents: 200000,
    expiresAt: new Date('2026-10-31T15:05:00Z'),
  });

  const rejected = await useCase.execute(
    payment.id,
    'REJECTED',
  );

  assert.equal(rejected.status, 'REJECTED');
});

test('permite reintentar cuando falla la pasarela', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 300000);

  const originalMethod = port.createPaymentIntent.bind(port);

  let attempts = 0;

  port.createPaymentIntent = async (input) => {
    attempts++;

    if (attempts === 1) {
      throw new Error('Pasarela no disponible');
    }

    return originalMethod(input);
  };

  await assert.rejects(
    useCase.execute('order-retry', 500000, expiresAt),
    /Pasarela no disponible/,
  );

  const pending = await repository.findByOrderId('order-retry');

  assert.ok(pending);
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.providerPaymentId, null);

  const recovered = await useCase.execute(
    'order-retry',
    500000,
    expiresAt,
  );

  assert.equal(recovered.id, pending.id);
  assert.equal(recovered.providerPaymentId, `fake-${pending.id}`);
  assert.equal(attempts, 2);
});

test('no vuelve a solicitar una intención ya registrada', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 300000);

  const first = await useCase.execute(
    'order-existing',
    500000,
    expiresAt,
  );

  const second = await useCase.execute(
    'order-existing',
    500000,
    expiresAt,
  );

  assert.equal(first.id, second.id);
  assert.equal(port.createdIntents.length, 1);
});

test('rechaza un reintento con un importe diferente', async () => {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const useCase = new CreatePaymentUseCase(repository, port);

  const expiresAt = new Date(Date.now() + 300000);

  await useCase.execute('order-conflict', 500000, expiresAt);

  await assert.rejects(
    useCase.execute('order-conflict', 600000, expiresAt),
    /PAYMENT_REQUEST_CONFLICT/,
  );

  assert.equal(port.createdIntents.length, 1);
});




