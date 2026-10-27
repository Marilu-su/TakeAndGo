import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CreateOrderUseCase } from '../src/modules/order/application/createOrderUseCase';
import { CancelOrderUseCase } from '../src/modules/order/application/cancelOrderUseCase';
import { ReleaseExpiredReservationsUseCase } from '../src/modules/order/application/releaseExpiredReservationsUseCase';
import { OrderRepository, CreateOrderInput } from '../src/modules/order/domain/orderRepository';
import { StockRepository, StockCheckItem } from '../src/modules/stock/domain/stockRepository';
import { Order, OrderStatus } from '../src/modules/order/domain/order';

// 1. Repositorio de órdenes en memoria para pruebas
class InMemoryOrderRepository implements OrderRepository {
  public orders: Order[] = [];
  private currentNumber = 0;

  async create(input: CreateOrderInput): Promise<Order> {
    this.currentNumber++;
    const order: Order = {
      id: `order-${this.orders.length + 1}`,
      storeId: input.storeId,
      customerId: input.customerId,
      orderNumber: this.currentNumber,
      status: input.status ?? 'RESERVED',
      totalCents: input.totalCents,
      reservedUntil: input.reservedUntil ?? null,
      pickupCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: input.items.map((item, index) => ({
        id: `item-${index + 1}`,
        productId: item.productId ?? null,
        productNameSnapshot: item.productNameSnapshot,
        unitPriceCentsSnapshot: item.unitPriceCentsSnapshot,
        quantity: item.quantity,
        subtotalCents: item.subtotalCents,
        additions: item.additions?.map((add, addIndex) => ({
          id: `item-add-${addIndex + 1}`,
          additionId: add.additionId ?? null,
          additionNameSnapshot: add.additionNameSnapshot,
          unitPriceCentsSnapshot: add.unitPriceCentsSnapshot,
          quantity: add.quantity,
          subtotalCents: add.subtotalCents,
        })),
      })),
    };
    this.orders.push(order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  async findByStoreAndNumber(storeId: string, orderNumber: number): Promise<Order | null> {
    return this.orders.find((o) => o.storeId === storeId && o.orderNumber === orderNumber) ?? null;
  }

  async findActiveByCustomer(customerId: string): Promise<Order[]> {
    return this.orders.filter(
      (o) => o.customerId === customerId && !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status)
    );
  }

  async findExpiredReservations(now: Date): Promise<Order[]> {
    return this.orders.filter(
      (o) => o.status === 'RESERVED' && o.reservedUntil && o.reservedUntil < now
    );
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    order.status = status;
    return order;
  }
}

// 2. Repositorio de stock en memoria para pruebas
class InMemoryStockRepository implements StockRepository {
  public inventory: Record<string, { available: number; reserved: number }> = {};
  public releaseCallsCount = 0;
  public reserveCallsCount = 0;

  setStock(productId: string, available: number, reserved: number = 0) {
    this.inventory[productId] = { available, reserved };
  }

  async hasSufficientStock(_storeId: string, items: StockCheckItem[]): Promise<boolean> {
    for (const item of items) {
      const stock = this.inventory[item.productId];
      if (!stock || stock.available < item.quantity) {
        return false;
      }
    }
    return true;
  }

  async reserveStock(_storeId: string, _orderId: string, items: StockCheckItem[]): Promise<void> {
    this.reserveCallsCount++;
    for (const item of items) {
      const stock = this.inventory[item.productId];
      if (stock) {
        stock.available -= item.quantity;
        stock.reserved += item.quantity;
      }
    }
  }

  async releaseStock(_storeId: string, _orderId: string, items: StockCheckItem[]): Promise<void> {
    this.releaseCallsCount++;
    for (const item of items) {
      const stock = this.inventory[item.productId];
      if (stock) {
        stock.available += item.quantity;
        stock.reserved -= item.quantity;
      }
    }
  }

  async fulfillStock(_storeId: string, _orderId: string, items: StockCheckItem[]): Promise<void> {
    for (const item of items) {
      const stock = this.inventory[item.productId];
      if (stock) {
        stock.reserved -= item.quantity;
      }
    }
  }

  async setProductStock(): Promise<any> {}
  async setAdditionStock(): Promise<any> {}
}

describe('Módulo Transaccional: Pedidos y Stock (C2-15)', () => {
  test('falla la creación del pedido si no hay stock suficiente', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const stockRepo = new InMemoryStockRepository();
    const useCase = new CreateOrderUseCase(orderRepo, stockRepo);

    // Stock configurado en 1 unidad, pero se piden 3
    stockRepo.setStock('prod-1', 1, 0);

    await assert.rejects(
      async () => {
        await useCase.execute({
          storeId: 'store-1',
          customerId: 'cust-1',
          items: [{ productId: 'prod-1', quantity: 3 }],
        });
      },
      {
        message: /Stock insuficiente/i,
      }
    );

    assert.equal(orderRepo.orders.length, 0);
  });

  test('cancela un pedido y libera el stock previamente reservado', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const stockRepo = new InMemoryStockRepository();
    const cancelUseCase = new CancelOrderUseCase(orderRepo, stockRepo);

    stockRepo.setStock('prod-1', 5, 2);

    const createdOrder = await orderRepo.create({
      storeId: 'store-1',
      customerId: 'cust-1',
      totalCents: 1000,
      status: 'RESERVED',
      items: [
        {
          productId: 'prod-1',
          productNameSnapshot: 'Café',
          unitPriceCentsSnapshot: 500,
          quantity: 2,
          subtotalCents: 1000,
        },
      ],
    });

    const cancelledOrder = await cancelUseCase.execute(createdOrder.id);

    assert.equal(cancelledOrder.status, 'CANCELLED');
    assert.equal(stockRepo.releaseCallsCount, 1);
    assert.equal(stockRepo.inventory['prod-1'].available, 7);
    assert.equal(stockRepo.inventory['prod-1'].reserved, 0);
  });

  test('libera reservas vencidas por expiración de tiempo', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const stockRepo = new InMemoryStockRepository();
    const releaseUseCase = new ReleaseExpiredReservationsUseCase(orderRepo, stockRepo);

    stockRepo.setStock('prod-1', 2, 2);

    const now = new Date('2026-10-27T12:00:00Z');
    const pastDate = new Date('2026-10-27T11:40:00Z'); // 20 minutos atrás (expirada)

    const order = await orderRepo.create({
      storeId: 'store-1',
      customerId: 'cust-1',
      totalCents: 1200,
      status: 'RESERVED',
      reservedUntil: pastDate,
      items: [
        {
          productId: 'prod-1',
          productNameSnapshot: 'Empanada',
          unitPriceCentsSnapshot: 600,
          quantity: 2,
          subtotalCents: 1200,
        },
      ],
    });

    const result = await releaseUseCase.execute(now);

    assert.equal(result.releasedOrdersCount, 1);
    assert.deepEqual(result.orderIds, [order.id]);

    const updatedOrder = await orderRepo.findById(order.id);
    assert.equal(updatedOrder?.status, 'CANCELLED');
    assert.equal(stockRepo.releaseCallsCount, 1);
    assert.equal(stockRepo.inventory['prod-1'].available, 4);
    assert.equal(stockRepo.inventory['prod-1'].reserved, 0);
  });
});