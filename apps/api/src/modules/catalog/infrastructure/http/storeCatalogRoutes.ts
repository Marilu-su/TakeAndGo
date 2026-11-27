import { Router } from 'express';

import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { StoreCatalogUseCases } from '../catalogModule';
import { filterStoreCatalog } from '../../domain/storeCatalog';
import type { CustomerPreferences } from '../../../customer/infrastructure/customerModule';

type Dependencies = {
    useCases: StoreCatalogUseCases;
    resolveActor: ActorResolver;
    getCustomerPreferences: (userId: string) => Promise<CustomerPreferences>;
};

export function createStoreCatalogRouter({ useCases, resolveActor, getCustomerPreferences }: Dependencies) {
    const router = Router();

    router.get('/stores/:storeId/catalog', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        let catalog = await useCases.viewStoreCatalog(actor, req.params.storeId);
        if (actor.role === 'CUSTOMER') {
            const preferences = await getCustomerPreferences(actor.userId);
            catalog = filterStoreCatalog(catalog, preferences.dietaryRestrictions, preferences.allergies);
        }

        res.status(200).json(catalog);
    });

    return router;
}
