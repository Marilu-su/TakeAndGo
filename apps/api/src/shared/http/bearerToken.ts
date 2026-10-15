const BEARER_PREFIX = 'bearer ';

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader?.toLowerCase().startsWith(BEARER_PREFIX)) {
        return null;
    }

    const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();

    return token.length > 0 ? token : null;
}