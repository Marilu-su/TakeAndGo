import type { Request } from 'express';

import type { Actor } from '../auth/actor';

export type ActorResolver = (req: Request) => Promise<Actor | null>;

// Hasta que exista la autenticación (TDD-0001), ninguna request tiene un usuario identificado.
// TDD-0001 reemplaza este resolver por uno que obtenga el actor a partir de la sesión o el token.
export const unauthenticatedActorResolver: ActorResolver = async () => null;