import 'dotenv/config';

import { getPrisma } from '../src/infrastructure/database/prisma';

async function main() {
    const prisma = getPrisma();

    await prisma.$queryRaw`SELECT 1`;

    // Los datos iniciales se agregan junto con cada feature.
    console.log('Seed ejecutado: todavía no hay datos iniciales para cargar.');
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