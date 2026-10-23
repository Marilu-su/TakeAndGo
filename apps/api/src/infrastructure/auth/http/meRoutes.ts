import { Router } from 'express';

import type { ActorResolver } from '../../../shared/http/actorResolver';
import { requireActor } from '../../../shared/http/requireActor';

type Dependencies = {
    resolveActor: ActorResolver;
};

export function createMeRouter({ resolveActor }: Dependencies) {
    const router = Router();

    router.get('/me', async (req, res) => {
        const actor = await requireActor(resolveActor, req);

        res.status(200).json(actor);
    });

    return router;
}