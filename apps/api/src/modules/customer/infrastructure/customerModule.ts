import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeAssociateCustomerToStore } from '../application/associateCustomerToStore';
import { makeCreateCustomer } from '../application/createCustomer';
import { makeGetCustomer } from '../application/getCustomer';
import { makeListCustomerStores } from '../application/listCustomerStores';
import { PrismaStoreRepository } from '../../organization/infrastructure/prismaStoreRepository';
import { PrismaCustomerRepository } from './prismaCustomerRepository';
import { PrismaCustomerStoreMembershipRepository } from './prismaCustomerStoreMembershipRepository';
import { makeRegisterCustomer } from '../application/registerCustomer';

export type CreateCustomer = ReturnType<typeof makeCreateCustomer>;
export type GetCustomer = ReturnType<typeof makeGetCustomer>;
export type AssociateCustomerToStore = ReturnType<
    typeof makeAssociateCustomerToStore
>;
export type ListCustomerStores = ReturnType<typeof makeListCustomerStores>;

export function createPrismaCreateCustomer(): CreateCustomer {
    return (command) => {
        const prisma = getPrisma();

        const createCustomer = makeCreateCustomer({
            customers: new PrismaCustomerRepository(prisma),
        });

        return createCustomer(command);
    };
}

export function createPrismaGetCustomer(): GetCustomer {
    return (customerId) => {
        const prisma = getPrisma();

        const getCustomer = makeGetCustomer({
            customers: new PrismaCustomerRepository(prisma),
        });

        return getCustomer(customerId);
    };
}

export function createPrismaAssociateCustomerToStore(): AssociateCustomerToStore {
    return (command) => {
        const prisma = getPrisma();

        const associateCustomerToStore = makeAssociateCustomerToStore({
            customers: new PrismaCustomerRepository(prisma),
            stores: new PrismaStoreRepository(prisma),
            memberships: new PrismaCustomerStoreMembershipRepository(prisma),
        });

        return associateCustomerToStore(command);
    };
}

export function createPrismaListCustomerStores(): ListCustomerStores {
    return (customerId) => {
        const prisma = getPrisma();

        const listCustomerStores = makeListCustomerStores({
            customers: new PrismaCustomerRepository(prisma),
            stores: new PrismaStoreRepository(prisma),
            memberships: new PrismaCustomerStoreMembershipRepository(prisma),
        });

        return listCustomerStores(customerId);
    };
}

export type RegisterCustomer = ReturnType<typeof makeRegisterCustomer>;

export function createPrismaRegisterCustomer(): RegisterCustomer {
    return (identity, command) => {
        const prisma = getPrisma();

        const registerCustomer = makeRegisterCustomer({
            customers: new PrismaCustomerRepository(prisma),
        });

        return registerCustomer(identity, command);
    };
}