import { OrderRepository } from '../domain/orderRepository';
import { Order } from '../domain/order';

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }

    return order;
  }
}