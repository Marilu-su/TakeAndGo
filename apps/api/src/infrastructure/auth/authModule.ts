import { PrismaCustomerRepository } from '../../modules/customer/infrastructure/prismaCustomerRepository';
import { PrismaStaffScopeRepository } from '../../modules/organization/infrastructure/prismaStaffScopeRepository';
import { unauthenticatedActorResolver, type ActorResolver } from '../../shared/http/actorResolver';
import {
    createTokenIdentityResolver,
    noIdentityResolver,
    type IdentityResolver,
} from '../../shared/http/identityResolver';
import { getPrisma } from '../database/prisma';
import { createActorResolver } from './createActorResolver';
import { createNeonAuthTokenVerifier } from './jwtTokenVerifier';

export type AuthResolvers = {
    resolveIdentity: IdentityResolver;
    resolveActor: ActorResolver;
};

export function createDefaultAuthResolvers(): AuthResolvers {
    const authUrl = process.env.NEON_AUTH_URL;

    if (!authUrl) {
        return {
        resolveIdentity: noIdentityResolver,
        resolveActor: unauthenticatedActorResolver,
        };
    }

    const resolveIdentity = createTokenIdentityResolver(createNeonAuthTokenVerifier(authUrl));

    return {
        resolveIdentity,
        resolveActor: createActorResolver({
        resolveIdentity,
        findStaffScope: (authUserId) => new PrismaStaffScopeRepository(getPrisma()).findByAuthUserId(authUserId),
        findCustomer: (authUserId) => new PrismaCustomerRepository(getPrisma()).findByAuthUserId(authUserId),
        }),
    };
}