import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { CategoryUseCases } from '../catalogModule';

type Dependencies = {
    useCases: CategoryUseCases;
    resolveActor: ActorResolver;
    };

    function readName(body: unknown): string {
    const name = (body as { name?: unknown } | undefined)?.name;

    if (typeof name !== 'string') {
        throw new DomainError('INVALID_REQUEST', 'El campo name es obligatorio y debe ser texto');
    }

    return name;
    }

    export function createCategoryRouter({ useCases, resolveActor }: Dependencies) {
    const router = Router();

    router.post('/stores/:storeId/categories', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const category = await useCases.createCategory(actor, {
        storeId: req.params.storeId,
        name: readName(req.body),
        });

        res.status(201).json(category);
    });

    router.get('/stores/:storeId/categories', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const categories = await useCases.listCategories(actor, req.params.storeId);

        res.status(200).json(categories);
    });

    router.patch('/stores/:storeId/categories/:categoryId', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const category = await useCases.updateCategory(actor, {
        storeId: req.params.storeId,
        categoryId: req.params.categoryId,
        name: readName(req.body),
        });

        res.status(200).json(category);
    });

    router.post('/stores/:storeId/categories/:categoryId/deactivate', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const category = await useCases.deactivateCategory(actor, {
        storeId: req.params.storeId,
        categoryId: req.params.categoryId,
        });

        res.status(200).json(category);
    });

    return router;
}