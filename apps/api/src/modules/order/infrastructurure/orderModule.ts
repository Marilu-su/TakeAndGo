import { OrderRepository } from '../domain/orderRepository';
import { PrismaOrderRepository } from './prismaOrderRepository';

export interface OrderModule {
  orderRepository: OrderRepository;
}

export function createOrderModule(): OrderModule {
  const orderRepository = new PrismaOrderRepository();

  return {
    orderRepository,
  };
}