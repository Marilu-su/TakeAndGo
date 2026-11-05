
import { DomainError } from '../../../shared/domain/DomainError';
import type { Order } from '../../order/domain/order';
import type { OrderRepository } from '../../order/domain/orderRepository';

export class ActivatePickupWhenEligibleUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId?.trim()) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar el pedido'
      );
    }

    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new DomainError(
        'NOT_FOUND',
        'Pedido no encontrado'
      );
    }

    // Solo pueden habilitarse pedidos en preparación.
    if (order.status !== 'PREPARING') {
      return order;
    }

    // Cocina todavía no finalizó la preparación.
    if (!order.preparedAt) {
      return order;
    }

    // Sin una ventana prometida no habilitamos el retiro.
    if (!order.promisedFrom || !order.promisedTo) {
      return order;
    }

    const currentTime = this.now();

    // Todavía no comenzó la ventana prometida.
    if (currentTime < order.promisedFrom) {
      return order;
    }

    // Si la ventana ya terminó, queda pendiente la replanificación.
    if (currentTime >= order.promisedTo) {
      return order;
    }

    // El pedido está preparado y dentro de su ventana.
    const updated =
      await this.orderRepository.activatePickupIfEligible(
        order.id,
        new Date(order.promisedFrom.getTime()),
        new Date(order.promisedTo.getTime()),
        currentTime
      );

    if (!updated) {
      // El pedido o su ventana pudo cambiar durante la operación.
      // No habilitamos el retiro con información desactualizada.
      const currentOrder = await this.orderRepository.findById(
        order.id
      );

      if (!currentOrder) {
        throw new DomainError(
          'NOT_FOUND',
          'Pedido no encontrado'
        );
      }

      return currentOrder;
    }

    return updated;
  }
}
