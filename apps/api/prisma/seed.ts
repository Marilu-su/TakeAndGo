import 'dotenv/config';

import { getPrisma } from '../src/infrastructure/database/prisma';

const SEED_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const SEED_STORE_CODE = 'SIS001';

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

    console.log(`Seed ejecutado: organización "${organization.name}" y buffet "${store.name}" (${store.code}).`);
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