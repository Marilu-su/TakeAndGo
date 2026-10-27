import { Router } from 'express';
import type { OrderModule } from '../orderModule';

export function createOrderRouter(orderModule: OrderModule): Router {
  const router = Router();

  // POST /orders
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

  // GET /orders/:id
  router.get('/orders/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await orderModule.getOrderByIdUseCase.execute(id);
      return res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}