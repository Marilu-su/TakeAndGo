import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { Order } from '../../../order/domain/order';
import { isValidMercadoPagoSignature } from '../mercadoPagoWebhookSignature';
import type { PaymentModule } from '../paymentModule';

export type PaymentHttpDependencies = {
  resolveActor: ActorResolver;
  findOrder: (orderId: string) => Promise<Order | null>;
  paymentModule: PaymentModule;
};

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

  // Contrato MVP-05, endpoint 2: consultar el estado (verificado con el proveedor).
  router.get('/orders/:orderId/payment', async (req, res) => {
    const order = await ownedOrder(req, req.params.orderId);
    const status = await deps.paymentModule.getPaymentStatus.execute(order);

    res.json(status);
  });

  // Contrato MVP-05, endpoint 3: aviso de Mercado Pago. Público, sin sesión.
  router.post('/payments/webhooks/mercadopago', async (req, res) => {
    const body = (req.body ?? {}) as { type?: unknown; data?: { id?: unknown } };
    const queryId = req.query['data.id'];
    const dataId = String(typeof queryId === 'string' ? queryId : body.data?.id ?? '');
    const type = String(req.query.type ?? body.type ?? req.query.topic ?? '');

    const secret = deps.paymentModule.webhookSecret;

    if (secret) {
      const valid = isValidMercadoPagoSignature({
        secret,
        signature: header(req.headers['x-signature']),
        requestId: header(req.headers['x-request-id']),
        dataId: typeof queryId === 'string' ? queryId : dataId,
      });

      if (!valid) {
        throw new DomainError('INVALID_WEBHOOK_SIGNATURE', 'Firma del aviso inválida');
      }
    }

    // Solo interesan los avisos de pagos; el resto se acepta y se ignora.
    if (type === 'payment' && dataId) {
      await deps.paymentModule.handleNotification.execute(dataId);
    }

    res.status(200).json({ received: true });
  });

  return router;
}
