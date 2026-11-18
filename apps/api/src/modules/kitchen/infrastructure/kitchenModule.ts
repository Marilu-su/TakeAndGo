
import type { OrderRepository } from '../../order/domain/orderRepository';
import { StartPreparationUseCase } from '../application/startPreparationUseCase';
import { FinishPreparationUseCase } from '../application/finishPreparationUseCase';
import { DomainError } from '../../../shared/domain/DomainError';
import type { Actor } from '../../../shared/auth/actor';
import { isStoreStaff } from '../../catalog/domain/catalogAuthorization';

export interface KitchenModule {
  startPreparationUseCase: StartPreparationUseCase;
  finishPreparationUseCase: FinishPreparationUseCase;
  listKitchenQueue: (actor: Actor, storeId: string) => ReturnType<OrderRepository['findKitchenQueue']>;
}

export function createKitchenModule(
  orderRepository: OrderRepository
): KitchenModule {
  return {
    startPreparationUseCase: new StartPreparationUseCase(orderRepository),
    finishPreparationUseCase: new FinishPreparationUseCase(orderRepository),
    listKitchenQueue: (actor, storeId) => {
      if (!isStoreStaff(actor, storeId)) throw new DomainError('FORBIDDEN', 'No tenés permisos para operar en este buffet.');
      return orderRepository.findKitchenQueue(storeId);
    },
  };
}
