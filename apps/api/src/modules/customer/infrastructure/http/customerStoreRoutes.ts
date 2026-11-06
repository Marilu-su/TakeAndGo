import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { AssociateCustomerToStore, ListCustomerStores } from '../customerModule';

export function createCustomerStoreRouter(deps: {
  resolveActor: ActorResolver;
  listStores: ListCustomerStores;
  associateStore: AssociateCustomerToStore;
}) {
  const router = Router();
  router.get('/me/stores', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente');
    res.json(await deps.listStores(actor.userId));
  });
  router.post('/me/stores', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente');
    if (typeof req.body?.storeCode !== 'string') throw new DomainError('INVALID_REQUEST', 'El código del buffet es obligatorio');
    const membership = await deps.associateStore({ customerId: actor.userId, storeCode: req.body.storeCode });
    res.status(201).json(membership);
  });
  return router;
}
