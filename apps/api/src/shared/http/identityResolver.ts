import type { Request } from 'express';

import type { AuthenticatedIdentity, TokenVerifier } from '../auth/tokenVerifier';
import { extractBearerToken } from './bearerToken';

export type IdentityResolver = (req: Request) => Promise<AuthenticatedIdentity | null>;

export const noIdentityResolver: IdentityResolver = async () => null;

export function createTokenIdentityResolver(verifier: TokenVerifier): IdentityResolver {
    return async (req) => {
        const token = extractBearerToken(req.headers.authorization);

        return token ? verifier.verify(token) : null;
    };
}