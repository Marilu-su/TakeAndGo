import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateStore } from '../application/createStore';
import { makeGetStoreConfiguration } from '../application/getStoreConfiguration';
import { PrismaOrganizationRepository } from './prismaOrganizationRepository';
import { PrismaStoreRepository } from './prismaStoreRepository';
import { makeAssignStaffRole } from '../application/assignStaffRole';
import { PrismaStaffScopeRepository } from './prismaStaffScopeRepository';
import { makeListOrganizationStores } from '../application/listOrganizationStores';
import { makeDeactivateStore } from '../application/deactivateStore';
import { makeSetOrganizationMaxAdvanceDays } from '../application/setOrganizationMaxAdvanceDays';
import { DomainError } from '../../../shared/domain/DomainError';

export type CreateStore = ReturnType<typeof makeCreateStore>;
export type GetStoreConfiguration = ReturnType<typeof makeGetStoreConfiguration>;

function buildRepositories() {
    const prisma = getPrisma();

    return {
        organizations: new PrismaOrganizationRepository(prisma),
        stores: new PrismaStoreRepository(prisma),
        staffScopes: new PrismaStaffScopeRepository(prisma),
    };
}

export function createPrismaCreateStore(): CreateStore {
    return (actor, command) => makeCreateStore(buildRepositories())(actor, command);
}

export function createPrismaGetStoreConfiguration(): GetStoreConfiguration {
    return (storeId) => makeGetStoreConfiguration(buildRepositories())(storeId);
}

export function createPrismaStoreManagement() {
    return {
        list: (actor: import('../../../shared/auth/actor').Actor, organizationId: string) => makeListOrganizationStores(buildRepositories().stores)(actor, organizationId),
        deactivate: (actor: import('../../../shared/auth/actor').Actor, storeId: string) => makeDeactivateStore(buildRepositories())(actor, storeId),
        getSettings: async (actor: import('../../../shared/auth/actor').Actor, organizationId: string) => {
            if (actor.role !== 'ORGANIZATION_ADMIN' || actor.organizationId !== organizationId) throw new DomainError('FORBIDDEN', 'No administrás esta organización.');
            const organization = await getPrisma().organization.findUnique({ where: { id: organizationId }, select: { id: true, maxAdvanceDays: true } });
            if (!organization) throw new DomainError('ORGANIZATION_NOT_FOUND', 'La organización no existe.');
            return organization;
        },
        setMaxAdvanceDays: (actor: import('../../../shared/auth/actor').Actor, organizationId: string, days: number) => makeSetOrganizationMaxAdvanceDays({ organizations: buildRepositories().organizations })(actor, organizationId, days),
    };
}

export type AssignStaffRole = ReturnType<typeof makeAssignStaffRole>;

export function createPrismaAssignStaffRole(): AssignStaffRole {
    return (command) => makeAssignStaffRole(buildRepositories())(command);
}

export async function createPrismaOrganizationForOwner(identity: { authUserId: string }, name: string) {
    const prisma = getPrisma();
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 120) throw new Error('El nombre de la organización debe tener entre 1 y 120 caracteres.');
    return prisma.$transaction(async (transaction) => {
        const existingScope = await transaction.staffScope.findUnique({ where: { authUserId: identity.authUserId } });
        if (existingScope) throw new Error('El usuario ya tiene un rol administrativo asignado.');

        const organization = await transaction.organization.create({
            data: { name: normalizedName },
        });
        await transaction.staffScope.create({
            data: {
                authUserId: identity.authUserId,
                role: 'ORGANIZATION_ADMIN',
                organizationId: organization.id,
            },
        });
        return organization;
    });
}

export async function createPrismaStaffAssignment(input: { actor: import('../../../shared/auth/actor').Actor; email: string; role: 'STORE_ADMIN' | 'STORE_EMPLOYEE'; storeId: string }) {
    const prisma = getPrisma();
    const store = await prisma.store.findUnique({ where: { id: input.storeId } });
    const canManageOrganization = input.actor.role === 'ORGANIZATION_ADMIN' && input.actor.organizationId === store?.organizationId;
    const canManageEmployees = input.actor.role === 'STORE_ADMIN' && input.actor.storeId === input.storeId && input.role === 'STORE_EMPLOYEE';
    if (!canManageOrganization && !canManageEmployees) throw new Error('No tenés permisos para asignar este rol en el buffet.');
    if (!store) throw new Error('El buffet no pertenece a tu organización.');
    const users = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM neon_auth."user" WHERE lower(email) = lower(${input.email.trim()})
    `;
    if (!users[0]) throw new Error('La persona debe crear su cuenta antes de asignarle un rol.');
    return prisma.staffScope.upsert({
        where: { authUserId: String(users[0].id) },
        create: { authUserId: String(users[0].id), role: input.role, organizationId: store.organizationId, storeId: store.id },
        update: { role: input.role, organizationId: store.organizationId, storeId: store.id },
    });
}
