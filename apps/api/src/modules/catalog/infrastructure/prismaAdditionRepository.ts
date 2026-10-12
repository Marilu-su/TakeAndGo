import type { PrismaClient } from '../../../generated/prisma/client';
import type { AdditionRepositoryPort } from '../application/ports';
import type { Addition, NewAddition } from '../domain/addition';

type AdditionRecord = {
    id: string;
    storeId: string;
    name: string;
    priceCents: number;
    isActive: boolean;
};

function toDomain(record: AdditionRecord): Addition {
    return {
        id: record.id,
        storeId: record.storeId,
        name: record.name,
        priceCents: record.priceCents,
        isActive: record.isActive,
    };
}

export class PrismaAdditionRepository implements AdditionRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Addition | null> {
        const record = await this.prisma.addition.findUnique({ where: { id } });

        return record ? toDomain(record) : null;
    }

    async findManyByIds(ids: string[]): Promise<Addition[]> {
        if (ids.length === 0) {
        return [];
        }

        const records = await this.prisma.addition.findMany({ where: { id: { in: ids } } });

        return records.map(toDomain);
    }

    async listByStore(storeId: string): Promise<Addition[]> {
        const records = await this.prisma.addition.findMany({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
        });

        return records.map(toDomain);
    }

    async create(addition: NewAddition): Promise<Addition> {
        const record = await this.prisma.addition.create({
        data: {
            storeId: addition.storeId,
            name: addition.name,
            priceCents: addition.priceCents,
            isActive: addition.isActive,
        },
        });

        return toDomain(record);
    }

    async update(addition: Addition): Promise<Addition> {
        const record = await this.prisma.addition.update({
        where: { id: addition.id },
        data: {
            name: addition.name,
            priceCents: addition.priceCents,
            isActive: addition.isActive,
        },
        });

        return toDomain(record);
    }
}