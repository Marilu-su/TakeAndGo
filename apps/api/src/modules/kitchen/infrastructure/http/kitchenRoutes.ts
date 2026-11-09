
import { Router } from 'express';

import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { KitchenModule } from '../kitchenModule';

type Dependencies = {
  kitchenModule: KitchenModule;
  resolveActor: ActorResolver;
};

export function createKitchenRouter({
  kitchenModule,
  resolveActor,
}: Dependencies): Router {
  const router = Router();

  // Iniciar preparación
  router.post(
    '/stores/:storeId/kitchen/orders/:orderId/start',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);

      const { storeId, orderId } = req.params;

      if (!storeId || !orderId) {
        throw new DomainError(
          'INVALID_REQUEST',
          'Debe indicar el buffet y el pedido'
        );
      }

      const order = await kitchenModule.startPreparationUseCase.execute(
        actor,
        storeId,
        orderId
      );

      res.status(200).json(order);
    }
  );

  // Finalizar preparación
  router.post(
    '/stores/:storeId/kitchen/orders/:orderId/finish',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);

      const { storeId, orderId } = req.params;

      const order = await kitchenModule.finishPreparationUseCase.execute(
        actor,
        storeId,
        orderId
      );

      res.status(200).json(order);
    }
  );

  return router;
}
