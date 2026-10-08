import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import type { CreateStore } from '../organizationModule';

type Dependencies = {
    createStore: CreateStore;
    resolveActor: ActorResolver;
};

export function createOrganizationRouter({ createStore, resolveActor }: Dependencies) {
    const router = Router();

    router.post('/organizations/:organizationId/stores', async (req, res) => {
        const actor = await resolveActor(req);

        if (!actor) {
        throw new DomainError('UNAUTHENTICATED', 'Se requiere autenticación');
        }

        const { name, code } = req.body ?? {};

        if (typeof name !== 'string' || typeof code !== 'string') {
        throw new DomainError('INVALID_REQUEST', 'Los campos name y code son obligatorios y deben ser texto');
        }

        const store = await createStore(actor, {
        organizationId: req.params.organizationId,
        name,
        code,
        });

        res.status(201).json(store);
    });

    return router;
}