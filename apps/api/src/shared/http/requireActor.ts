import type { Actor } from '../auth/actor';
import { DomainError } from '../domain/DomainError';
import type { ActorResolver } from './actorResolver';

export async function requireActor(
    resolveActor: ActorResolver,
    req: Parameters<ActorResolver>[0],
    ): Promise<Actor> {
    const actor = await resolveActor(req);

    if (!actor) {
        throw new DomainError('UNAUTHENTICATED', 'Se requiere autenticación');
    }

    return actor;
}