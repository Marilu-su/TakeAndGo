
import test from 'node:test';
import assert from 'node:assert/strict';

import { ProcessLatePaymentCompensationUseCase } from '../src/modules/payment/application/processLatePaymentCompensationUseCase';

type Dependencies = ConstructorParameters<
  typeof ProcessLatePaymentCompensationUseCase
>;

test('una aprobación tardía solicita una única devolución', async () => {
  let refundCalls = 0;
  let compensationCreated = false;
  let completed = false;

  const paymentRepository = {
    findById: async () => ({
      id: 'payment-1',
      orderId: 'order-1',
      providerPaymentId: 'provider-1',
      amountCents: 2500,
      status: 'PENDING',
    }),
  } as unknown as Dependencies[0];

  const orderRepository = {
    findById: async () => ({
      id: 'order-1',
      status: 'EXPIRED',
    }),
  } as unknown as Dependencies[1];

  
const compensationRepository = {
  tryCreatePending: async () => {
    if (compensationCreated) return false;
    compensationCreated = true;
    return true;
  },
  findByPaymentId: async () => ({
    status: completed ? ('COMPLETED' as const) : ('PENDING' as const),
    providerRefundId: completed ? 'refund-1' : null,
  }),
  markCompleted: async () => {
    completed = true;
    return { status: 'COMPLETED' as const };
  },
};


  const refundPort = {
    refundPayment: async () => {
      refundCalls++;
      return { providerRefundId: 'refund-1' };
    },
  };

  const useCase = new ProcessLatePaymentCompensationUseCase(
    paymentRepository,
    orderRepository,
    compensationRepository,
    refundPort,
  );

  await useCase.execute('payment-1');

  await useCase.execute('payment-1');

  assert.equal(refundCalls, 1);
  assert.equal(completed, true);
});

test('no marca la compensación como completada si falla el proveedor', async () => {
  let completed = false;

  const paymentRepository = {
    findById: async () => ({
      id: 'payment-2',
      orderId: 'order-2',
      providerPaymentId: 'provider-2',
      amountCents: 2500,
      status: 'PENDING',
    }),
  } as unknown as Dependencies[0];

  const orderRepository = {
    findById: async () => ({
      id: 'order-2',
      status: 'EXPIRED',
    }),
  } as unknown as Dependencies[1];

  const compensationRepository = {
    tryCreatePending: async () => true,
    markCompleted: async () => {
      completed = true;
      return { status: 'COMPLETED' as const };
    },
  };

  const refundPort = {
    refundPayment: async (): Promise<{
      providerRefundId: string;
    }> => {
      throw new Error('PROVIDER_UNAVAILABLE');
    },
  };

  const useCase = new ProcessLatePaymentCompensationUseCase(
    paymentRepository,
    orderRepository,
    compensationRepository,
    refundPort,
  );

  await assert.rejects(
    useCase.execute('payment-2'),
    /PROVIDER_UNAVAILABLE/,
  );

  assert.equal(completed, false);
});

test('no vuelve a reembolsar una compensación completada', async () => {
  let refundCalls = 0;

  const paymentRepository = {
    findById: async () => ({
      id: 'payment-3',
      orderId: 'order-3',
      providerPaymentId: 'provider-3',
      amountCents: 2500,
      status: 'REFUNDED',
    }),
  } as unknown as Dependencies[0];

  const orderRepository = {
    findById: async () => ({
      id: 'order-3',
      status: 'EXPIRED',
    }),
  } as unknown as Dependencies[1];

  const compensationRepository = {
    tryCreatePending: async () => false,
    findByPaymentId: async () => ({
      status: 'COMPLETED' as const,
      providerRefundId: 'refund-3',
    }),
    markCompleted: async () => {
      throw new Error('No debe ejecutarse');
    },
  };

  const refundPort = {
    refundPayment: async () => {
      refundCalls++;
      return { providerRefundId: 'refund-new' };
    },
  };

  const useCase = new ProcessLatePaymentCompensationUseCase(
    paymentRepository,
    orderRepository,
    compensationRepository,
    refundPort,
  );

  await useCase.execute('payment-3');

  assert.equal(refundCalls, 0);
});

test('no reembolsa otra vez si la compensación está pendiente', async () => {
  let refundCalls = 0;

  const paymentRepository = {
    findById: async () => ({
      id: 'payment-4',
      orderId: 'order-4',
      providerPaymentId: 'provider-4',
      amountCents: 2500,
      status: 'PENDING',
    }),
  } as unknown as Dependencies[0];

  const orderRepository = {
    findById: async () => ({
      id: 'order-4',
      status: 'EXPIRED',
    }),
  } as unknown as Dependencies[1];

  const compensationRepository = {
    tryCreatePending: async () => false,
    findByPaymentId: async () => ({
      status: 'PENDING' as const,
      providerRefundId: null,
    }),
    markCompleted: async () => {
      throw new Error('No debe ejecutarse');
    },
  };

  const refundPort = {
    refundPayment: async () => {
      refundCalls++;
      return { providerRefundId: 'refund-4' };
    },
  };

  const useCase = new ProcessLatePaymentCompensationUseCase(
    paymentRepository,
    orderRepository,
    compensationRepository,
    refundPort,
  );

  await assert.rejects(
    useCase.execute('payment-4'),
    /COMPENSATION_ALREADY_EXISTS/,
  );

  assert.equal(refundCalls, 0);
});

