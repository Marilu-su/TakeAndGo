import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
    if (!prisma) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('La variable de entorno DATABASE_URL no está configurada');
        }

        const adapter = new PrismaPg({ connectionString });
        prisma = new PrismaClient({ adapter });
    }

    return prisma;
}