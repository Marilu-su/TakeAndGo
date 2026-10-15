import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { AuthenticatedIdentity, TokenVerifier } from '../../shared/auth/tokenVerifier';

export class JwtTokenVerifier implements TokenVerifier {
    private readonly keys: JWTVerifyGetKey;
    private readonly issuer: string;
    private readonly audience: string;

    constructor(keys: JWTVerifyGetKey, issuer: string, audience: string) {
        this.keys = keys;
        this.issuer = issuer;
        this.audience = audience;
    }

    async verify(token: string): Promise<AuthenticatedIdentity | null> {
        try {
        const { payload } = await jwtVerify(token, this.keys, {
            issuer: this.issuer,
            audience: this.audience,
        });

        if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
            return null;
        }

        return {
            authUserId: payload.sub,
            email: typeof payload.email === 'string' ? payload.email : null,
        };
        } catch (error) {
        if (error instanceof errors.JOSEError) {
            return null;
        }

        throw error;
        }
    }
}

export function createNeonAuthTokenVerifier(authUrl: string): TokenVerifier {
    const baseUrl = authUrl.replace(/\/$/, '');
    const origin = new URL(baseUrl).origin;
    const keys = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));

    return new JwtTokenVerifier(keys, origin, origin);
}