
import type { OrderRepository } from '../domain/orderRepository';
import type { StockRepository } from '../../stock/domain/stockRepository';

export interface ReleaseExpiredReservationsResult {
  releasedOrdersCount: number;
  orderIds: string[];
}

export interface ExpireOrderPort {
  expireOrder(orderId: string, now: Date): Promise<boolean>;
}

export class ReleaseExpiredReservationsUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly stockRepository: StockRepository,
    private readonly expireOrderPort?: ExpireOrderPort,
  ) {}

  async execute(
    referenceDate: Date = new Date(),
  ): Promise<ReleaseExpiredReservationsResult> {
    const expiredOrders =
      await this.orderRepository.findExpiredReservations(referenceDate);

    const releasedOrderIds: string[] = [];

    for (const order of expiredOrders) {
      if (this.expireOrderPort) {
        const expired = await this.expireOrderPort.expireOrder(
          order.id,
          referenceDate,
        );

        if (expired) {
          releasedOrderIds.push(order.id);
        }

        continue;
      }

      // Compatibilidad con el flujo anterior.
      const stockItems = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        additionIds: item.additions
          ?.map((addition) => addition.additionId)
          .filter(Boolean) as string[],
      }));

      await this.stockRepository.releaseStock(
        order.storeId,
        order.id,
        stockItems,
      );

      await this.orderRepository.updateStatus(
        order.id,
        'CANCELLED',
      );

      releasedOrderIds.push(order.id);
    }

    return {
      releasedOrdersCount: releasedOrderIds.length,
      orderIds: releasedOrderIds,
    };
  }
}
