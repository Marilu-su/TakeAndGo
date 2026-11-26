import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { Order } from '../../../order/domain/order';
import type { PaymentModule } from '../paymentModule';

export type PaymentHttpDependencies = {
  resolveActor: ActorResolver;
  findOrder: (orderId: string) => Promise<Order | null>;
  paymentModule: PaymentModule;
};

export function createPaymentRouter(deps: PaymentHttpDependencies): Router {
  const router = Router();

  // Pedido del cliente autenticado; si es de otro, responde como si no existiera.
  const ownedOrder = async (req: Parameters<ActorResolver>[0], orderId: string) => {
    const actor = await requireActor(deps.resolveActor, req);

    if (actor.role !== 'CUSTOMER') {
      throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente');
    }

    const order = await deps.findOrder(orderId);

    if (!order || order.customerId !== actor.userId) {
      throw new DomainError('ORDER_NOT_FOUND', 'El pedido no existe');
    }

    return order;
  };

  // Contrato MVP-05, endpoint 1: iniciar el pago.
  router.post('/orders/:orderId/payment', async (req, res) => {
    const order = await ownedOrder(req, req.params.orderId);
    const checkout = await deps.paymentModule.startCheckout.execute(order);

    res.status(201).json(checkout);
  });

  return router;
}
