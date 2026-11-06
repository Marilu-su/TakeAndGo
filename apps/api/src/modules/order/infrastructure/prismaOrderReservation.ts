import { getPrisma } from '../../../infrastructure/database/prisma';
import { DomainError } from '../../../shared/domain/DomainError';
import type { CreateOrderInput } from '../domain/orderRepository';
import type { ReserveStockItemInput } from '../../stock/domain/stockRepository';
import { PrismaOrderRepository } from './prismaOrderRepository';
import { PrismaStockRepository } from '../../stock/infrastructure/prismaStockRepository';

export async function placeReservedOrder(input: CreateOrderInput, items: ReserveStockItemInput[]) {
  return getPrisma().$transaction(async tx => {
    // Serializes numbering and reservation within this buffet; parameterized SQL.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${input.storeId}))`;
    const orders = new PrismaOrderRepository(tx);
    const stock = new PrismaStockRepository(tx);
    const order = await orders.create(input);
    await stock.reserveStock(input.storeId, order.id, items);
    return order;
  }, { timeout: 20000 });
}

export async function cancelReservedOrder(orderId: string) {
  return getPrisma().$transaction(async tx => {
    const orders = new PrismaOrderRepository(tx);
    const order = await orders.findById(orderId);
    if (!order) throw new DomainError('ORDER_NOT_FOUND', 'El pedido no existe');
    if (order.status === 'CANCELLED') return order;
    if (order.status !== 'RESERVED') throw new DomainError('ORDER_STATE_CONFLICT', 'Solo se pueden cancelar reservas pendientes.');
    const changed = await tx.order.updateMany({ where: { id: orderId, status: 'RESERVED' }, data: { status: 'CANCELLED' } });
    if (changed.count !== 1) throw new DomainError('ORDER_STATE_CONFLICT', 'El pedido cambió de estado. Actualizá la consulta.');
    await new PrismaStockRepository(tx).releaseStock(order.storeId, order.id, order.items.map(item => ({ productId: item.productId, quantity: item.quantity, additionIds: item.additions.flatMap(a => a.additionId ? [a.additionId] : []) })));
    return { ...order, status: 'CANCELLED' as const };
  }, { timeout: 20000 });
}
