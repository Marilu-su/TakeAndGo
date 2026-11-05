
import type { OrderRepository } from '../../order/domain/orderRepository';
import { ActivatePickupWhenEligibleUseCase } from './activatePickupWhenEligibleUseCase';

export interface ActivateEligiblePickupsResult {
  activatedOrdersCount: number;
  orderIds: string[];
}

export class ActivateEligiblePickupsUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly activatePickup: ActivatePickupWhenEligibleUseCase,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(): Promise<ActivateEligiblePickupsResult> {
    const currentTime = this.now();

    // Buscar pedidos preparados cuya ventana ya comenzó.
    const candidates =
      await this.orderRepository.findPreparedOrdersInPickupWindow(
        currentTime
      );

    const activatedOrderIds: string[] = [];

    for (const order of candidates) {
      // El caso de uso individual vuelve a validar las condiciones.
      const result = await this.activatePickup.execute(order.id);

      if (result.status === 'READY_FOR_PICKUP') {
        activatedOrderIds.push(result.id);
      }
    }

    return {
      activatedOrdersCount: activatedOrderIds.length,
      orderIds: activatedOrderIds,
    };
  }
}
