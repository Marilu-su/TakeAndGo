import type { AuthenticatedIdentity } from '../auth/tokenVerifier';
import { DomainError } from '../domain/DomainError';
import type { IdentityResolver } from './identityResolver';

export async function requireIdentity(
    resolveIdentity: IdentityResolver,
    req: Parameters<IdentityResolver>[0],
    ): Promise<AuthenticatedIdentity> {
    const identity = await resolveIdentity(req);

    if (!identity) {
        throw new DomainError('UNAUTHENTICATED', 'Se requiere autenticación');
    }

    return identity;
}