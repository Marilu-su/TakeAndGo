import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { ProductChanges } from '../../domain/product';
import type { ProductUseCases } from '../catalogModule';
import {
    optionalNullableString,
    optionalNumber,
    optionalString,
    requireNumber,
    requireString,
    requireStringArray,
} from './requestBody';

type Dependencies = {
    useCases: ProductUseCases;
    resolveActor: ActorResolver;
};

function readProductChanges(body: unknown): ProductChanges {
    const changes: ProductChanges = {
        categoryId: optionalString(body, 'categoryId'),
        name: optionalString(body, 'name'),
        description: optionalNullableString(body, 'description'),
        priceCents: optionalNumber(body, 'priceCents'),
        basePreparationSeconds: optionalNumber(body, 'basePreparationSeconds'),
    };

    const hasChanges = Object.values(changes).some((value) => value !== undefined);

    if (!hasChanges) {
        throw new DomainError('INVALID_REQUEST', 'Debe indicar al menos un campo para modificar');
    }

    return changes;
}

export function createProductRouter({ useCases, resolveActor }: Dependencies) {
    const router = Router();

    router.post('/stores/:storeId/products', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const product = await useCases.createProduct(actor, {
        storeId: req.params.storeId,
        categoryId: requireString(req.body, 'categoryId'),
        name: requireString(req.body, 'name'),
        description: optionalNullableString(req.body, 'description'),
        priceCents: requireNumber(req.body, 'priceCents'),
        basePreparationSeconds: requireNumber(req.body, 'basePreparationSeconds'),
        });

        res.status(201).json(product);
    });

    router.get('/stores/:storeId/products', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        res.status(200).json(await useCases.listProducts(actor, req.params.storeId));
    });

    router.patch('/stores/:storeId/products/:productId', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const product = await useCases.updateProduct(actor, {
        storeId: req.params.storeId,
        productId: req.params.productId,
        changes: readProductChanges(req.body),
        });

        res.status(200).json(product);
    });

    router.post('/stores/:storeId/products/:productId/deactivate', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const product = await useCases.deactivateProduct(actor, {
        storeId: req.params.storeId,
        productId: req.params.productId,
        });

        res.status(200).json(product);
    });

    router.get('/stores/:storeId/products/:productId/additions', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const additions = await useCases.listProductAdditions(actor, {
        storeId: req.params.storeId,
        productId: req.params.productId,
        });

        res.status(200).json(additions);
    });

    router.put('/stores/:storeId/products/:productId/additions', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const additions = await useCases.configureProductAdditions(actor, {
        storeId: req.params.storeId,
        productId: req.params.productId,
        additionIds: requireStringArray(req.body, 'additionIds'),
        });

        res.status(200).json(additions);
    });

    return router;
}