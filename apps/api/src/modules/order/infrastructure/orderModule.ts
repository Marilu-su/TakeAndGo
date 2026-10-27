import { OrderRepository } from '../domain/orderRepository';
import { PrismaOrderRepository } from './prismaOrderRepository';
import { CreateOrderUseCase } from '../application/createOrderUseCase';
import { GetOrderByIdUseCase } from '../application/getOrderByIdUseCase';
import { StockRepository } from '../../stock/domain/stockRepository';

export interface OrderModule {
  orderRepository: OrderRepository;
  createOrderUseCase: CreateOrderUseCase;
  getOrderByIdUseCase: GetOrderByIdUseCase;
}

export function createOrderModule(stockRepository: StockRepository): OrderModule {
  const orderRepository = new PrismaOrderRepository();
  const createOrderUseCase = new CreateOrderUseCase(orderRepository, stockRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);

  return {
    orderRepository,
    createOrderUseCase,
    getOrderByIdUseCase,
  };
}