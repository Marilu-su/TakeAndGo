import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { createPrismaStoreCatalogUseCases } from '../../../../src/modules/catalog/infrastructure/catalogModule';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'arma el catálogo completo desde PostgreSQL y aplica la autorización por buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const { viewStoreCatalog } = createPrismaStoreCatalogUseCases();

        const organization = await prisma.organization.create({
        data: { name: 'Organización de prueba (test catálogo)' },
        });
        const store = await prisma.store.create({
        data: {
            organizationId: organization.id,
            name: 'Buffet de prueba',
            code: `CTL${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            status: 'ACTIVE',
        },
        });

        const associatedCustomer = await prisma.customer.create({
        data: { name: 'Cliente asociado', email: `asociado-${randomUUID()}@test.com` },
        });
        const otherCustomer = await prisma.customer.create({
        data: { name: 'Cliente no asociado', email: `otro-${randomUUID()}@test.com` },
        });

        try {
        await prisma.customerStoreMembership.create({
            data: { customerId: associatedCustomer.id, storeId: store.id },
        });

        const drinks = await prisma.category.create({ data: { storeId: store.id, name: 'Bebidas' } });
        const hidden = await prisma.category.create({ data: { storeId: store.id, name: 'Oculta', isActive: false } });

        const coffee = await prisma.product.create({
            data: {
            storeId: store.id,
            categoryId: drinks.id,
            name: 'Café con leche',
            priceCents: 150000,
            basePreparationSeconds: 120,
            },
        });
        await prisma.product.create({
            data: {
            storeId: store.id,
            categoryId: drinks.id,
            name: 'Producto desactivado',
            priceCents: 1000,
            basePreparationSeconds: 10,
            isActive: false,
            },
        });
        await prisma.product.create({
            data: {
            storeId: store.id,
            categoryId: hidden.id,
            name: 'Producto de categoría oculta',
            priceCents: 1000,
            basePreparationSeconds: 10,
            },
        });

        const almond = await prisma.addition.create({
            data: { storeId: store.id, name: 'Leche de almendras', priceCents: 50000 },
        });
        const disabledAddition = await prisma.addition.create({
            data: { storeId: store.id, name: 'Adicional desactivado', priceCents: 1000, isActive: false },
        });

        await prisma.productAddition.createMany({
            data: [
            { productId: coffee.id, additionId: almond.id, storeId: store.id },
            { productId: coffee.id, additionId: disabledAddition.id, storeId: store.id },
            ],
        });

        // El cliente asociado ve solo lo activo, agrupado por categoría
        const catalog = await viewStoreCatalog({ userId: associatedCustomer.id, role: 'CUSTOMER' }, store.id);

        assert.deepEqual(catalog.categories.map((c) => c.name), ['Bebidas']);
        assert.deepEqual(catalog.categories[0].products.map((p) => p.name), ['Café con leche']);
        assert.deepEqual(catalog.categories[0].products[0].additions.map((a) => a.name), ['Leche de almendras']);

        // Un cliente no asociado no puede ver el catálogo
        await assert.rejects(
            viewStoreCatalog({ userId: otherCustomer.id, role: 'CUSTOMER' }, store.id),
            { code: 'FORBIDDEN' },
        );
        } finally {
        await prisma.customerStoreMembership.deleteMany({ where: { storeId: store.id } });
        await prisma.customer.deleteMany({ where: { id: { in: [associatedCustomer.id, otherCustomer.id] } } });
        await prisma.productAddition.deleteMany({ where: { storeId: store.id } });
        await prisma.product.deleteMany({ where: { storeId: store.id } });
        await prisma.addition.deleteMany({ where: { storeId: store.id } });
        await prisma.category.deleteMany({ where: { storeId: store.id } });
        await prisma.store.delete({ where: { id: store.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});