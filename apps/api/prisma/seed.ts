import 'dotenv/config';

import { getPrisma } from '../src/infrastructure/database/prisma';

const SEED_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const SEED_STORE_CODE = 'SIS001';

const SEED_CATEGORIES = [
    { id: '22222222-2222-4222-8222-222222222221', name: 'Bebidas' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Sándwiches' },
    { id: '22222222-2222-4222-8222-222222222223', name: 'Panadería' },
];

const SEED_PRODUCTS = [
    {
        id: '33333333-3333-4333-8333-333333333331',
        categoryId: '22222222-2222-4222-8222-222222222221',
        name: 'Café con leche',
        description: 'Café con leche en taza grande',
        priceCents: 150000,
        basePreparationSeconds: 120,
    },
    {
        id: '33333333-3333-4333-8333-333333333332',
        categoryId: '22222222-2222-4222-8222-222222222222',
        name: 'Sándwich de miga',
        description: 'Jamón y queso, tres unidades',
        priceCents: 250000,
        basePreparationSeconds: 60,
    },
    {
        id: '33333333-3333-4333-8333-333333333333',
        categoryId: '22222222-2222-4222-8222-222222222223',
        name: 'Medialuna',
        description: null,
        priceCents: 80000,
        basePreparationSeconds: 30,
    },
];

const SEED_ADDITIONS = [
    { id: '44444444-4444-4444-8444-444444444441', name: 'Leche de almendras', priceCents: 50000 },
    { id: '44444444-4444-4444-8444-444444444442', name: 'Medialuna extra', priceCents: 80000 },
];

const SEED_PRODUCT_ADDITIONS = [
    { productId: '33333333-3333-4333-8333-333333333331', additionId: '44444444-4444-4444-8444-444444444441' },
    { productId: '33333333-3333-4333-8333-333333333331', additionId: '44444444-4444-4444-8444-444444444442' },
];

async function main() {
    const prisma = getPrisma();

    const organization = await prisma.organization.upsert({
        where: { id: SEED_ORGANIZATION_ID },
        update: {},
        create: {
            id: SEED_ORGANIZATION_ID,
            name: 'UTN FRLP',
        },
    });

    const store = await prisma.store.upsert({
        where: { code: SEED_STORE_CODE },
        update: {},
        create: {
            organizationId: organization.id,
            name: 'Buffet Sistemas',
            code: SEED_STORE_CODE,
            status: 'ACTIVE',
        },
    });

    for (const category of SEED_CATEGORIES) {
        await prisma.category.upsert({
            where: { id: category.id },
            update: {},
            create: {
                id: category.id,
                storeId: store.id,
                name: category.name,
            },
        });
    }

        for (const product of SEED_PRODUCTS) {
        await prisma.product.upsert({
            where: { id: product.id },
            update: {},
            create: { ...product, storeId: store.id },
        });
    }

    for (const addition of SEED_ADDITIONS) {
        await prisma.addition.upsert({
            where: { id: addition.id },
            update: {},
            create: { ...addition, storeId: store.id },
        });
    }

    for (const link of SEED_PRODUCT_ADDITIONS) {
        await prisma.productAddition.upsert({
            where: { productId_additionId: link },
            update: {},
            create: { ...link, storeId: store.id },
        });
    }

    console.log(
        `Seed ejecutado: buffet "${store.name}" (${store.code}) con ${SEED_CATEGORIES.length} categorías, ${SEED_PRODUCTS.length} productos y ${SEED_ADDITIONS.length} adicionales.`,
    );
}

main()
    .then(async () => {
        await getPrisma().$disconnect();
    })
    .catch(async (error: unknown) => {
        console.error('Error al ejecutar el seed:', error);
        process.exitCode = 1;

        try {
            await getPrisma().$disconnect();
        } catch {
            // No hay conexión para cerrar.
        }
    });