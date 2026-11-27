import { Router } from 'express';
import type { Actor } from '../../../../shared/auth/actor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { ListPickupWindowsUseCase } from '../../application/listPickupWindowsUseCase';

export type PickupWindowHttpDependencies = {
  resolveActor: ActorResolver;
  requireCatalogAccess: (actor: Actor, storeId: string) => Promise<void>;
  getAvailability: ListPickupWindowsUseCase['getAvailability'];
};

export function createPickupWindowRouter({
  resolveActor,
  requireCatalogAccess,
  getAvailability,
}: PickupWindowHttpDependencies): Router {
  const router = Router();

  router.get('/stores/:storeId/pickup-windows', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    if (actor.role !== 'CUSTOMER') {
      throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente');
    }

    const { storeId } = req.params;
    await requireCatalogAccess(actor, storeId);
    res.set('Cache-Control', 'no-store').json(await getAvailability(storeId));
  });

  return router;
}
