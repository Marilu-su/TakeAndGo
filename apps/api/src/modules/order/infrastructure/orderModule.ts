import { OrderRepository } from '../domain/orderRepository';
import { PrismaOrderRepository } from './prismaOrderRepository';
import { CreateOrderUseCase } from '../application/createOrderUseCase';
import { GetOrderByIdUseCase } from '../application/getOrderByIdUseCase';
import { CancelOrderUseCase } from '../application/cancelOrderUseCase';
import { ReleaseExpiredReservationsUseCase } from '../application/releaseExpiredReservationsUseCase';
import { StockRepository } from '../../stock/domain/stockRepository';
import { PrismaPaymentOrderStockAdapter } from '../../payment/infrastructure/prismaPaymentOrderStockAdapter';

export interface OrderModule {
  orderRepository: OrderRepository;
  createOrderUseCase: CreateOrderUseCase;
  getOrderByIdUseCase: GetOrderByIdUseCase;
  cancelOrderUseCase: CancelOrderUseCase;
  releaseExpiredReservationsUseCase: ReleaseExpiredReservationsUseCase;
}

export function createOrderModule(stockRepository: StockRepository): OrderModule {
  const orderRepository = new PrismaOrderRepository();
  const createOrderUseCase = new CreateOrderUseCase(orderRepository, stockRepository);
  const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
  const cancelOrderUseCase = new CancelOrderUseCase(orderRepository, stockRepository);
const releaseExpiredReservationsUseCase =
  new ReleaseExpiredReservationsUseCase(
    orderRepository,
    stockRepository,
    new PrismaPaymentOrderStockAdapter(),
  );


  return {
    orderRepository,
    createOrderUseCase,
    getOrderByIdUseCase,
    cancelOrderUseCase,
    releaseExpiredReservationsUseCase,
  };
}