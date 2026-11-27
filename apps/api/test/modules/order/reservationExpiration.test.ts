import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CreateOrderUseCase, RESERVATION_MINUTES } from '../../../src/modules/order/application/createOrderUseCase';
import { ReleaseExpiredReservationsUseCase } from '../../../src/modules/order/application/releaseExpiredReservationsUseCase';
import type { Order } from '../../../src/modules/order/domain/order';
import type { CreateOrderInput, OrderRepository } from '../../../src/modules/order/domain/orderRepository';
import type { StockRepository } from '../../../src/modules/stock/domain/stockRepository';

test('reserva: el pedido queda reservado 5 minutos para pagar', async () => {
  let placed: CreateOrderInput | undefined;
  const useCase = new CreateOrderUseCase(
    {} as OrderRepository,
    { hasSufficientStock: async () => true } as unknown as StockRepository,
    {
      getStore: async () => ({ id: 's1' }),
      getProduct: async () => ({ id: 'p1', storeId: 's1', isActive: true, name: 'Café', priceCents: 150000 }),
      getAddition: async () => null,
    } as never,
    async input => {
      placed = input;
      return { id: 'o1', ...input } as unknown as Order;
    },
  );

  const before = Date.now();
  await useCase.execute({ storeId: 's1', customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }] });
  const after = Date.now();

  assert.equal(RESERVATION_MINUTES, 5);
  const reservedUntil = placed!.reservedUntil!.getTime();
  assert.ok(reservedUntil >= before + 5 * 60_000 && reservedUntil <= after + 5 * 60_000);
});

test('vencimiento: un pedido con problemas no impide vencer los demás', async () => {
  const expired = ['o1', 'o2', 'o3'].map(id => ({ id, items: [] }) as unknown as Order);
  const attempts: string[] = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    const useCase = new ReleaseExpiredReservationsUseCase(
      { findExpiredReservations: async () => expired } as unknown as OrderRepository,
      {} as StockRepository,
      {
        expireOrder: async (orderId: string) => {
          attempts.push(orderId);
          if (orderId === 'o2') throw new Error('PAYMENT_ORDER_STATE_CONFLICT');
          return true;
        },
      },
    );

    const result = await useCase.execute(new Date());

    assert.deepEqual(attempts, ['o1', 'o2', 'o3']);
    assert.deepEqual(result.orderIds, ['o1', 'o3']);
  } finally {
    console.error = originalError;
  }
});
