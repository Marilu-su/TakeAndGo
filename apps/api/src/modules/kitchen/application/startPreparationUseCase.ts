import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { isStoreStaff } from '../../catalog/domain/catalogAuthorization';
import type { Order } from '../../order/domain/order';
import type { OrderRepository } from '../../order/domain/orderRepository';

export class StartPreparationUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

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

  if (order.status !== 'CONFIRMED') {
    throw new DomainError(
      'INVALID_KITCHEN_STATE',
      'El pedido debe estar confirmado para iniciar su preparación'
    );
  }

  const updated = await this.orderRepository.updateStatusIfCurrent(
    order.id,
    'CONFIRMED',
    'PREPARING'
  );

  if (!updated) {
    throw new DomainError(
      'INVALID_KITCHEN_STATE',
      'El pedido cambió de estado durante la operación'
    );
  }

  return updated;
}
}