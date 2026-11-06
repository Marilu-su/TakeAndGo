
import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { isStoreStaff } from '../../catalog/domain/catalogAuthorization';
import type { Order } from '../../order/domain/order';
import type { OrderRepository } from '../../order/domain/orderRepository';

export class FinishPreparationUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(
    actor: Actor,
    storeId: string,
    orderId: string
  ): Promise<Order> {
    if (!storeId?.trim() || !orderId?.trim()) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar el buffet y el pedido'
      );
    }

    if (!isStoreStaff(actor, storeId)) {
      throw new DomainError(
        'FORBIDDEN',
        'No tiene permisos para operar en este buffet'
      );
    }

    const order = await this.orderRepository.findById(orderId);

    if (!order || order.storeId !== storeId) {
      throw new DomainError(
        'NOT_FOUND',
        'Pedido no encontrado en este buffet'
      );
    }

    if (order.status !== 'PREPARING' || order.preparedAt != null) {
      throw new DomainError(
        'INVALID_KITCHEN_STATE',
        'El pedido no está disponible para finalizar su preparación'
      );
    }

    const updated = await this.orderRepository.finishPreparationIfCurrent(
      order.id,
      this.now(),
      actor.userId
    );

    if (!updated) {
      throw new DomainError(
        'INVALID_KITCHEN_STATE',
        'El pedido cambió durante la operación'
      );
    }

    return updated;
  }
}
