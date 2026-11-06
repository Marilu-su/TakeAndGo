import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { createPrismaStoreManagement } from '../organizationModule';
export function createStoreManagementRouter(resolveActor: ActorResolver, stores: ReturnType<typeof createPrismaStoreManagement>) {
  const router = Router();
  router.get('/organizations/:organizationId/stores', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    res.json(await stores.list(actor, req.params.organizationId));
  });
  router.post('/stores/:storeId/deactivate', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    res.json(await stores.deactivate(actor, req.params.storeId));
  });
  return router;
}
