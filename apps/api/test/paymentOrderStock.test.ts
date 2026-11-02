
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ProcessPaymentResultUseCase,
  type PaymentOrderStockPort,
} from '../src/modules/payment/application/processPaymentResultUseCase';

test('envía la aprobación al coordinador de pagos', async () => {
  const calls: string[] = [];

  const port: PaymentOrderStockPort = {
    async applyResult(paymentId, result, now) {
      calls.push(`${paymentId}:${result}`);

      return {
        id: paymentId,
        orderId: 'order-1',
        status: result,
        amountCents: 500000,
        expiresAt: new Date(now.getTime() + 60000),
        providerPaymentId: 'provider-1',
        createdAt: now,
        updatedAt: now,
      };
    },
  };

  const useCase = new ProcessPaymentResultUseCase(port);

  const result = await useCase.execute(
    'payment-1',
    'APPROVED',
  );

  assert.equal(result.status, 'APPROVED');
  assert.deepEqual(calls, ['payment-1:APPROVED']);
});

test('rechaza un identificador de pago vacío', async () => {
  const port: PaymentOrderStockPort = {
    async applyResult() {
      throw new Error('No debería ejecutarse');
    },
  };

  const useCase = new ProcessPaymentResultUseCase(port);

  await assert.rejects(
    () => useCase.execute('', 'REJECTED'),
    /El pago es obligatorio/,
  );
});

test('solicita compensación cuando se aprueba un pago de un pedido vencido', async () => {
  let compensationRequested = false;

  const paymentOrderStock = {
    async applyResult() {
      throw new Error('ORDER_NOT_RESERVED');
    },
  };

  const compensation = {
    async execute(paymentId: string) {
      assert.equal(paymentId, 'payment-123');
      compensationRequested = true;
    },
  };

  const useCase = new ProcessPaymentResultUseCase(
    paymentOrderStock,
    () => new Date('2026-11-01T12:00:00Z'),
    compensation,
  );

  await assert.rejects(
    useCase.execute('payment-123', 'APPROVED'),
    /LATE_PAYMENT_COMPENSATED/,
  );

  assert.equal(compensationRequested, true);
});
