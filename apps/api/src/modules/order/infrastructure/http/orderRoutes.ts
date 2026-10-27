import { Router } from 'express';
import { OrderModule } from '../orderModule';

export function createOrderRouter(orderModule: OrderModule): Router {
  const router = Router();

  // POST /orders - Crear pedido con reserva de stock
  router.post('/orders', async (req, res, next) => {
    try {
      const { storeId, customerId, items } = req.body;

      if (!storeId || !customerId || !items || !Array.isArray(items)) {
        return res.status(400).json({
          error: 'storeId, customerId e items son requeridos',
        });
      }

      const order = await orderModule.createOrderUseCase.execute({
        storeId,
        customerId,
        items,
      });

      return res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  });

  // POST /orders/release-expired - Proceso para liberar reservas vencidas
  router.post('/orders/release-expired', async (_req, res, next) => {
    try {
      const result = await orderModule.releaseExpiredReservationsUseCase.execute();
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  // GET /orders/:id - Consultar orden por ID
  router.get('/orders/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await orderModule.getOrderByIdUseCase.execute(id);
      return res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  });

  // POST /orders/:id/cancel - Cancelar orden y liberar stock
  router.post('/orders/:id/cancel', async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await orderModule.cancelOrderUseCase.execute(id);
      return res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}