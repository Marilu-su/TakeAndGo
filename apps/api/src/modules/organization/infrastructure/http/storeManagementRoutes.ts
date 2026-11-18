import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { createPrismaStoreManagement } from '../organizationModule';
import { createPrismaStaffAssignment } from '../organizationModule';
export function createStoreManagementRouter(resolveActor: ActorResolver, stores: ReturnType<typeof createPrismaStoreManagement>) {
  const router = Router();
  router.get('/organizations/:organizationId/stores', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    res.json(await stores.list(actor, req.params.organizationId));
  });
  router.get('/organizations/:organizationId/settings', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    res.json(await stores.getSettings(actor, req.params.organizationId));
  });
  router.post('/stores/:storeId/deactivate', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    res.json(await stores.deactivate(actor, req.params.storeId));
  });
  router.patch('/organizations/:organizationId/settings', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    const days = req.body?.maxAdvanceDays;
    if (typeof days !== 'number' || !Number.isInteger(days)) throw new DomainError('INVALID_REQUEST', 'La anticipación debe ser un número entero de días.');
    res.json(await stores.setMaxAdvanceDays(actor, req.params.organizationId, days));
  });
  router.post('/stores/:storeId/staff', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    const { email, role } = req.body ?? {};
    if (typeof email !== 'string' || role !== 'STORE_EMPLOYEE') throw new DomainError('INVALID_REQUEST', 'Indicá el email y el rol STORE_EMPLOYEE.');
    try {
      const scope = await createPrismaStaffAssignment({ actor, email, role, storeId: req.params.storeId });
      res.status(201).json({ email, role: scope.role, storeId: scope.storeId });
    } catch (error) {
      if (error instanceof Error && error.message.includes('debe crear')) throw new DomainError('STAFF_USER_NOT_FOUND', error.message);
      if (error instanceof Error && error.message.includes('permisos')) throw new DomainError('FORBIDDEN', error.message);
      if (error instanceof Error && error.message.includes('buffet no pertenece')) throw new DomainError('STORE_NOT_FOUND', error.message);
      throw error;
    }
  });
  return router;
}
