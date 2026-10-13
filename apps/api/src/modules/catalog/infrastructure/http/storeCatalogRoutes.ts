import { Router } from 'express';

import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { StoreCatalogUseCases } from '../catalogModule';

type Dependencies = {
    useCases: StoreCatalogUseCases;
    resolveActor: ActorResolver;
};

export function createStoreCatalogRouter({ useCases, resolveActor }: Dependencies) {
    const router = Router();

    router.get('/stores/:storeId/catalog', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const catalog = await useCases.viewStoreCatalog(actor, req.params.storeId);

        res.status(200).json(catalog);
    });

    return router;
}