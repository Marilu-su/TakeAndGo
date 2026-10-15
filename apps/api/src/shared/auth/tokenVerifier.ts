export type AuthenticatedIdentity = {
    authUserId: string;
    email: string | null;
};

/**
 * Verifica un token de acceso y devuelve la identidad del usuario,
 * o null si el token no es válido (vencido, mal firmado, de otro emisor, etc.).
 */
export interface TokenVerifier {
    verify(token: string): Promise<AuthenticatedIdentity | null>;
}