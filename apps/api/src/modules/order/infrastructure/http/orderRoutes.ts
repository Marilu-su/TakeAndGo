
import { Router } from 'express';

import type { Order } from '../../domain/order';
import { OrderModule } from '../orderModule';

/**
 * Elimina el código de retiro de las respuestas HTTP.
 * Las credenciales de retiro deben obtenerse mediante
 * endpoints específicos con autorización.
 */
function toPublicOrder(
  order: Order
): Omit<Order, 'pickupCode'> {
  const { pickupCode: _pickupCode, ...publicOrder } = order;

  return publicOrder;
}

export function createOrderRouter(
  orderModule: OrderModule
): Router {
  const router = Router();

  // POST /orders - Crear pedido con reserva de stock
  router.post('/orders', async (req, res, next) => {
    try {
      const { storeId, customerId, items } = req.body;

      if (
        !storeId ||
        !customerId ||
        !items ||
        !Array.isArray(items)
      ) {
        return res.status(400).json({
          error: 'storeId, customerId e items son requeridos',
        });
      }

      const order =
        await orderModule.createOrderUseCase.execute({
          storeId,
          customerId,
          items,
        });

      return res.status(201).json(
        toPublicOrder(order)
      );
    } catch (error) {
      next(error);
    }
  });

  // POST /orders/release-expired
  // Proceso para liberar reservas vencidas
  router.post(
    '/orders/release-expired',
    async (_req, res, next) => {
      try {
        const result =
          await orderModule.releaseExpiredReservationsUseCase.execute();

        return res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /orders/:id - Consultar pedido por ID
  router.get('/orders/:id', async (req, res, next) => {
    try {
      const { id } = req.params;

      const order =
        await orderModule.getOrderByIdUseCase.execute(id);

      // No exponer credenciales de retiro.
      return res.status(200).json(
        toPublicOrder(order)
      );
    } catch (error) {
      next(error);
    }
  });

  // POST /orders/:id/cancel
  // Cancelar pedido y liberar stock
  router.post(
    '/orders/:id/cancel',
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const order =
          await orderModule.cancelOrderUseCase.execute(id);

        return res.status(200).json(
          toPublicOrder(order)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
