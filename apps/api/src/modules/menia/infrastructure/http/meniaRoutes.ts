import { Router, type ErrorRequestHandler } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { MeniaUseCases } from '../../application/meniaUseCases';
import { DomainError } from '../../../../shared/domain/DomainError';

// Solo traduce errores del parser en MenIA; no cambia contratos de otras rutas.
export const meniaJsonErrorHandler: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error && typeof error === 'object' && 'type' in error &&
      (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')) {
    next(new DomainError('INVALID_REQUEST', 'Enviá un objeto JSON válido con un mensaje de hasta 2000 caracteres.'));
    return;
  }
  next(error);
};

export function createMeniaRouter(deps: { resolveActor: ActorResolver; useCases: MeniaUseCases }) {
  const router = Router();
  router.get('/stores/:storeId/menia/context', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    res.set('Cache-Control', 'no-store').json(await deps.useCases.getContext(actor, req.params.storeId));
  });
  router.post('/stores/:storeId/menia/messages', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    res.set('Cache-Control', 'no-store').json(await deps.useCases.sendMessage(actor, req.params.storeId, req.body));
  });
  return router;
}
