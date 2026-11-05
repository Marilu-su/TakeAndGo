import { Router } from 'express';
import type { OrderModule } from '../orderModule';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { StoreCatalogUseCases } from '../../../catalog/infrastructure/catalogModule';
import type { Order } from '../../domain/order';
import type { CreateOrderItemRequest } from '../../application/createOrderUseCase';

export type OrderHttpDependencies = {
  resolveActor: ActorResolver;
  viewCatalog: StoreCatalogUseCases['viewStoreCatalog'];
  listOrders: (customerId: string) => Promise<Order[]>;
};

export function createOrderRouter(orderModule: OrderModule, deps: OrderHttpDependencies): Router {
  const router = Router();
  const customer = async (req: Parameters<ActorResolver>[0]) => {
    const actor = await requireActor(deps.resolveActor, req);
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente');
    return actor;
  };
  const owned = async (req: Parameters<ActorResolver>[0], id: string) => {
    const actor = await customer(req);
    const order = await orderModule.orderRepository.findById(id);
    if (!order || order.customerId !== actor.userId) throw new DomainError('ORDER_NOT_FOUND', 'El pedido no existe');
    return order;
  };

  router.post('/orders', async (req, res) => {
    const actor = await customer(req);
    const { storeId, items } = req.body ?? {};
    if (typeof storeId !== 'string' || !Array.isArray(items) || items.length === 0) throw new DomainError('INVALID_REQUEST', 'Indicá buffet y productos');
    const catalog = await deps.viewCatalog(actor, storeId);
    const products = new Map(catalog.categories.flatMap(category => category.products.map(product => [product.id, product] as const)));
    const checked: CreateOrderItemRequest[] = items.map((raw: unknown) => {
      if (!raw || typeof raw !== 'object') throw new DomainError('INVALID_REQUEST', 'Producto inválido');
      const item = raw as Record<string, unknown>;
      if (typeof item.productId !== 'string' || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 2147483647) throw new DomainError('INVALID_REQUEST', 'Las cantidades deben ser enteros positivos');
      const product = products.get(item.productId);
      if (!product) throw new DomainError('INVALID_REQUEST', 'Uno de los productos ya no está disponible. Actualizá el catálogo.');
      const additionIds = item.additionIds ?? [];
      if (!Array.isArray(additionIds) || additionIds.some(id => typeof id !== 'string' || !product.additions.some(a => a.id === id)) || new Set(additionIds).size !== additionIds.length) throw new DomainError('INVALID_REQUEST', 'Adicionales inválidos para el producto');
      return { productId: item.productId, quantity: item.quantity, additionIds };
    });
    const total = checked.reduce((sum, item) => {
      const product = products.get(item.productId)!;
      return sum + (product.priceCents + product.additions.filter(a => item.additionIds?.includes(a.id)).reduce((n, a) => n + a.priceCents, 0)) * item.quantity;
    }, 0);
    if (!Number.isSafeInteger(total) || total > 2147483647) throw new DomainError('INVALID_REQUEST', 'El total supera el máximo admitido');
    try {
      const order = await orderModule.createOrderUseCase.execute({ storeId, customerId: actor.userId, items: checked });
      res.status(201).json(order);
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('Stock insuficiente')) throw new DomainError('INSUFFICIENT_STOCK', 'El stock cambió. Actualizá el catálogo y revisá el pedido.');
      throw cause;
    }
  });
  router.get('/orders', async (req, res) => {
    const actor = await customer(req);
    res.json(await deps.listOrders(actor.userId));
  });
  // Expiration is an internal operation, not a customer-triggered global job.
  router.post('/orders/release-expired', async (req) => {
    await requireActor(deps.resolveActor, req);
    throw new DomainError('FORBIDDEN', 'La liberación global de reservas es una operación interna');
  });
  router.get('/orders/:id', async (req, res) => res.json(await owned(req, req.params.id)));
  router.post('/orders/:id/cancel', async (req, res) => {
    const order = await owned(req, req.params.id);
    if (order.status !== 'RESERVED' && order.status !== 'CANCELLED') throw new DomainError('ORDER_STATE_CONFLICT', 'Solo se pueden cancelar reservas pendientes');
    res.json(await orderModule.cancelOrderUseCase.execute(order.id));
  });
  return router;
}
