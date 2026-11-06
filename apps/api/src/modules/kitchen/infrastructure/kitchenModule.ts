
import type { OrderRepository } from '../../order/domain/orderRepository';
import { StartPreparationUseCase } from '../application/startPreparationUseCase';
import { FinishPreparationUseCase } from '../application/finishPreparationUseCase';

export interface KitchenModule {
  startPreparationUseCase: StartPreparationUseCase;
  finishPreparationUseCase: FinishPreparationUseCase;
}

export function createKitchenModule(
  orderRepository: OrderRepository
): KitchenModule {
  return {
    startPreparationUseCase: new StartPreparationUseCase(orderRepository),
    finishPreparationUseCase: new FinishPreparationUseCase(orderRepository),
  };
}
