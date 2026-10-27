import { OrderRepository } from '../domain/orderRepository';
import { StockRepository } from '../../stock/domain/stockRepository';
import { Order } from '../domain/order';

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly stockRepository: StockRepository,
  ) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }

    if (order.status === 'CANCELLED') {
      return order;
    }

    // Si estaba reservado, devolvemos el stock al inventario
    if (order.status === 'RESERVED') {
      const stockItems = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        additionIds: item.additions?.map((a) => a.additionId).filter(Boolean) as string[],
      }));

      await this.stockRepository.releaseStock(order.storeId, order.id, stockItems);
    }

    return this.orderRepository.updateStatus(order.id, 'CANCELLED');
  }
}