import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProcessLatePaymentCompensationUseCase,
  type PaymentCompensationRepository,
} from '../../../apps/api/src/modules/payment/application/processLatePaymentCompensationUseCase';
import { FakePaymentRepository } from '../../../apps/api/test/support/fakePaymentRepository';

// Caracterización del comportamiento ACTUAL, no aceptación del negocio ni prueba
// de proveedor/PostgreSQL. Un PASS reproduce el riesgo B07; no lo soluciona.
type Dependencies = ConstructorParameters<typeof ProcessLatePaymentCompensationUseCase>;

async function fixture(failure: 'provider' | 'persistence') {
  const payments = new FakePaymentRepository();
  const payment = await payments.create({
    orderId: 'audit-order',
    amountCents: 2500,
    expiresAt: new Date('2026-11-12T12:00:00Z'),
    providerPaymentId: 'audit-provider-payment',
  });
  const orders = {
    findById: async () => ({ id: 'audit-order', status: 'EXPIRED' }),
  } as unknown as Dependencies[1];
  let pending = false;
  let providerAvailable = failure !== 'provider';
  let persistenceAvailable = failure !== 'persistence';
  let refundCalls = 0;
  let markCompletedCalls = 0;
  const compensations: PaymentCompensationRepository = {
    async tryCreatePending() {
      if (pending) return false;
      pending = true;
      return true;
    },
    async findByPaymentId() {
      return pending ? { status: 'PENDING', providerRefundId: null } : null;
    },
    async markCompleted() {
      markCompletedCalls++;
      if (!persistenceAvailable) throw new Error('AUDIT_PERSISTENCE_UNAVAILABLE');
      return { status: 'COMPLETED' };
    },
  };
  const useCase = new ProcessLatePaymentCompensationUseCase(
    payments,
    orders,
    compensations,
    {
      async refundPayment() {
        refundCalls++;
        if (!providerAvailable) throw new Error('AUDIT_PROVIDER_UNAVAILABLE');
        return { providerRefundId: 'audit-refund' };
      },
    },
  );
  return {
    execute: () => useCase.execute(payment.id),
    recoverDependencies: () => {
      providerAvailable = true;
      persistenceAvailable = true;
    },
    state: () => ({ pending, refundCalls, markCompletedCalls }),
  };
}

test('B07: si falla el proveedor, recuperar el proveedor no permite reanudar el reembolso pendiente', async () => {
  const scenario = await fixture('provider');
  await assert.rejects(scenario.execute(), /AUDIT_PROVIDER_UNAVAILABLE/);
  scenario.recoverDependencies();
  await assert.rejects(scenario.execute(), /COMPENSATION_ALREADY_EXISTS/);
  assert.deepEqual(scenario.state(), {
    pending: true, refundCalls: 1, markCompletedCalls: 0,
  });
});

test('B07: si refund retorna pero falla la persistencia, el retry tampoco reconcilia la referencia', async () => {
  const scenario = await fixture('persistence');
  await assert.rejects(scenario.execute(), /AUDIT_PERSISTENCE_UNAVAILABLE/);
  scenario.recoverDependencies();
  await assert.rejects(scenario.execute(), /COMPENSATION_ALREADY_EXISTS/);
  // No hay doble llamada refund, pero tampoco segundo intento de registrar el
  // resultado ya obtenido. Se necesita reconciliación; no retry ciego del cobro.
  assert.deepEqual(scenario.state(), {
    pending: true, refundCalls: 1, markCompletedCalls: 1,
  });
});
