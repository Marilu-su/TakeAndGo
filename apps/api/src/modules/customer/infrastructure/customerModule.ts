import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateCustomer } from '../application/createCustomer';
import { makeGetCustomer } from '../application/getCustomer';
import { PrismaCustomerRepository } from './prismaCustomerRepository';

export type CreateCustomer = ReturnType<typeof makeCreateCustomer>;
export type GetCustomer = ReturnType<typeof makeGetCustomer>;

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