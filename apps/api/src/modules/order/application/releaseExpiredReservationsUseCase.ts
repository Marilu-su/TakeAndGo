import { OrderRepository } from '../domain/orderRepository';
import { StockRepository } from '../../stock/domain/stockRepository';

export interface ReleaseExpiredReservationsResult {
  releasedOrdersCount: number;
  orderIds: string[];
}

export class ReleaseExpiredReservationsUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly stockRepository: StockRepository,
  ) {}

  async execute(referenceDate: Date = new Date()): Promise<ReleaseExpiredReservationsResult> {
    const expiredOrders = await this.orderRepository.findExpiredReservations(referenceDate);
    const releasedOrderIds: string[] = [];

    for (const order of expiredOrders) {
      // Mapear los ítems para devolver el stock
      const stockItems = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        additionIds: item.additions?.map((a) => a.additionId).filter(Boolean) as string[],
      }));

      // 1. Devolver el stock a availableStock
      await this.stockRepository.releaseStock(order.storeId, order.id, stockItems);

      // 2. Marcar la orden como CANCELLED (o EXPIRED)
      await this.orderRepository.updateStatus(order.id, 'CANCELLED');

      releasedOrderIds.push(order.id);
    }

    return {
      releasedOrdersCount: releasedOrderIds.length,
      orderIds: releasedOrderIds,
    };
  }
}