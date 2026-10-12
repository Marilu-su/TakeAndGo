import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { AdditionChanges } from '../../domain/addition';
import type { AdditionUseCases } from '../catalogModule';
import { optionalNumber, optionalString, requireNumber, requireString } from './requestBody';

type Dependencies = {
    useCases: AdditionUseCases;
    resolveActor: ActorResolver;
};

function readAdditionChanges(body: unknown): AdditionChanges {
    const changes: AdditionChanges = {
        name: optionalString(body, 'name'),
        priceCents: optionalNumber(body, 'priceCents'),
    };

    if (changes.name === undefined && changes.priceCents === undefined) {
        throw new DomainError('INVALID_REQUEST', 'Debe indicar al menos un campo para modificar');
    }

    return changes;
    }

export function createAdditionRouter({ useCases, resolveActor }: Dependencies) {
    const router = Router();

    router.post('/stores/:storeId/additions', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const addition = await useCases.createAddition(actor, {
        storeId: req.params.storeId,
        name: requireString(req.body, 'name'),
        priceCents: requireNumber(req.body, 'priceCents'),
        });

        res.status(201).json(addition);
    });

    router.get('/stores/:storeId/additions', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        res.status(200).json(await useCases.listAdditions(actor, req.params.storeId));
    });

    router.patch('/stores/:storeId/additions/:additionId', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const addition = await useCases.updateAddition(actor, {
        storeId: req.params.storeId,
        additionId: req.params.additionId,
        changes: readAdditionChanges(req.body),
        });

        res.status(200).json(addition);
    });

    router.post('/stores/:storeId/additions/:additionId/deactivate', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        const addition = await useCases.deactivateAddition(actor, {
        storeId: req.params.storeId,
        additionId: req.params.additionId,
        });

        res.status(200).json(addition);
    });

    return router;
}