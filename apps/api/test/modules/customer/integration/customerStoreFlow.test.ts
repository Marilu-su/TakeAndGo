import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import {
    createPrismaAssociateCustomerToStore,
    createPrismaCreateCustomer,
    createPrismaListCustomerStores,
} from '../../../../src/modules/customer/infrastructure/customerModule';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function randomStoreCode(): string {
    const letters = Array.from(
        { length: 3 },
        () => String.fromCharCode(65 + randomInt(0, 26)),
    ).join('');

    const numbers = String(randomInt(0, 1000)).padStart(3, '0');

    return `${letters}${numbers}`;
}

test(
    'flujo integrado: crea un customer, lo asocia por código y consulta su buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();

        const organization = await prisma.organization.create({
            data: {
                name: `Organización C2-05 ${randomUUID()}`,
            },
        });

        const storeCode = randomStoreCode();

        const store = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet integración C2-05',
                code: storeCode,
            },
        });

        let customerId: string | undefined;

        try {
            const createCustomer = createPrismaCreateCustomer();

            const customer = await createCustomer({
                name: 'Customer integración',
                email: `c2-05-${randomUUID()}@test.com`,
            });

            customerId = customer.id;

            const associateCustomerToStore =
                createPrismaAssociateCustomerToStore();

            const membership = await associateCustomerToStore({
                customerId: customer.id,
                storeCode,
            });

            assert.equal(membership.customerId, customer.id);
            assert.equal(membership.storeId, store.id);

            const listCustomerStores = createPrismaListCustomerStores();

            const stores = await listCustomerStores(customer.id);

            assert.equal(stores.length, 1);
            assert.equal(stores[0]?.id, store.id);
            assert.equal(stores[0]?.code, storeCode);
            assert.equal(stores[0]?.name, store.name);
        } finally {
            if (customerId) {
                await prisma.customerStoreMembership.deleteMany({
                    where: { customerId },
                });

                await prisma.customer.deleteMany({
                    where: { id: customerId },
                });
            }

            await prisma.store.deleteMany({
                where: { id: store.id },
            });

            await prisma.organization.deleteMany({
                where: { id: organization.id },
            });
        }
    },
);

test(
    'flujo integrado: un customer puede asociarse a buffets de distintas organizaciones',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();

        const organizationOne = await prisma.organization.create({
            data: {
                name: `Organización uno C2-05 ${randomUUID()}`,
            },
        });

        const organizationTwo = await prisma.organization.create({
            data: {
                name: `Organización dos C2-05 ${randomUUID()}`,
            },
        });

        const storeOne = await prisma.store.create({
            data: {
                organizationId: organizationOne.id,
                name: 'Buffet uno C2-05',
                code: randomStoreCode(),
            },
        });

        const storeTwo = await prisma.store.create({
            data: {
                organizationId: organizationTwo.id,
                name: 'Buffet dos C2-05',
                code: randomStoreCode(),
            },
        });

        let customerId: string | undefined;

        try {
            const createCustomer = createPrismaCreateCustomer();

            const customer = await createCustomer({
                name: 'Customer múltiples buffets',
                email: `c2-05-multiple-${randomUUID()}@test.com`,
            });

            customerId = customer.id;

            const associateCustomerToStore =
                createPrismaAssociateCustomerToStore();

            await associateCustomerToStore({
                customerId: customer.id,
                storeCode: storeOne.code,
            });

            await associateCustomerToStore({
                customerId: customer.id,
                storeCode: storeTwo.code,
            });

            const listCustomerStores = createPrismaListCustomerStores();

            const stores = await listCustomerStores(customer.id);

            assert.equal(stores.length, 2);

            assert.ok(
                stores.some((store) => store.id === storeOne.id),
            );

            assert.ok(
                stores.some((store) => store.id === storeTwo.id),
            );
        } finally {
            if (customerId) {
                await prisma.customerStoreMembership.deleteMany({
                    where: { customerId },
                });

                await prisma.customer.deleteMany({
                    where: { id: customerId },
                });
            }

            await prisma.store.deleteMany({
                where: {
                    id: {
                        in: [storeOne.id, storeTwo.id],
                    },
                },
            });

            await prisma.organization.deleteMany({
                where: {
                    id: {
                        in: [organizationOne.id, organizationTwo.id],
                    },
                },
            });
        }
    },
);

test(
    'flujo integrado: normaliza el código y rechaza una asociación duplicada',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();

        const organization = await prisma.organization.create({
            data: {
                name: `Organización duplicado C2-05 ${randomUUID()}`,
            },
        });

        const storeCode = randomStoreCode();

        const store = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet duplicado C2-05',
                code: storeCode,
            },
        });

        let customerId: string | undefined;

        try {
            const createCustomer = createPrismaCreateCustomer();

            const customer = await createCustomer({
                name: 'Customer duplicado integración',
                email: `c2-05-duplicate-${randomUUID()}@test.com`,
            });

            customerId = customer.id;

            const associateCustomerToStore =
                createPrismaAssociateCustomerToStore();

            await associateCustomerToStore({
                customerId: customer.id,
                storeCode: ` ${storeCode.toLowerCase()} `,
            });

            await assert.rejects(
                associateCustomerToStore({
                    customerId: customer.id,
                    storeCode,
                }),
                {
                    code: 'CUSTOMER_ALREADY_ASSOCIATED_TO_STORE',
                },
            );

            const memberships =
                await prisma.customerStoreMembership.findMany({
                    where: {
                        customerId: customer.id,
                    },
                });

            assert.equal(memberships.length, 1);
            assert.equal(memberships[0]?.storeId, store.id);
        } finally {
            if (customerId) {
                await prisma.customerStoreMembership.deleteMany({
                    where: { customerId },
                });

                await prisma.customer.deleteMany({
                    where: { id: customerId },
                });
            }

            await prisma.store.deleteMany({
                where: { id: store.id },
            });

            await prisma.organization.deleteMany({
                where: { id: organization.id },
            });
        }
    },
);

test(
    'flujo integrado: cada customer consulta solamente sus propios buffets',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();

        const organization = await prisma.organization.create({
            data: {
                name: `Organización aislamiento C2-05 ${randomUUID()}`,
            },
        });

        const storeOne = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet customer uno',
                code: randomStoreCode(),
            },
        });

        const storeTwo = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet customer dos',
                code: randomStoreCode(),
            },
        });

        const customerIds: string[] = [];

        try {
            const createCustomer = createPrismaCreateCustomer();

            const customerOne = await createCustomer({
                name: 'Customer uno',
                email: `c2-05-one-${randomUUID()}@test.com`,
            });

            const customerTwo = await createCustomer({
                name: 'Customer dos',
                email: `c2-05-two-${randomUUID()}@test.com`,
            });

            customerIds.push(customerOne.id, customerTwo.id);

            const associateCustomerToStore =
                createPrismaAssociateCustomerToStore();

            await associateCustomerToStore({
                customerId: customerOne.id,
                storeCode: storeOne.code,
            });

            await associateCustomerToStore({
                customerId: customerTwo.id,
                storeCode: storeTwo.code,
            });

            const listCustomerStores = createPrismaListCustomerStores();

            const storesOne = await listCustomerStores(customerOne.id);
            const storesTwo = await listCustomerStores(customerTwo.id);

            assert.equal(storesOne.length, 1);
            assert.equal(storesOne[0]?.id, storeOne.id);

            assert.equal(storesTwo.length, 1);
            assert.equal(storesTwo[0]?.id, storeTwo.id);
        } finally {
            await prisma.customerStoreMembership.deleteMany({
                where: {
                    customerId: {
                        in: customerIds,
                    },
                },
            });

            await prisma.customer.deleteMany({
                where: {
                    id: {
                        in: customerIds,
                    },
                },
            });

            await prisma.store.deleteMany({
                where: {
                    id: {
                        in: [storeOne.id, storeTwo.id],
                    },
                },
            });

            await prisma.organization.deleteMany({
                where: { id: organization.id },
            });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});