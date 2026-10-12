import type { PrismaClient } from '../../../generated/prisma/client';
import type { CategoryRepositoryPort } from '../application/ports';
import type { Category, NewCategory } from '../domain/category';

type CategoryRecord = {
    id: string;
    storeId: string;
    name: string;
    isActive: boolean;
};

function toDomain(record: CategoryRecord): Category {
    return {
        id: record.id,
        storeId: record.storeId,
        name: record.name,
        isActive: record.isActive,
    };
    }

    export class PrismaCategoryRepository implements CategoryRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Category | null> {
        const record = await this.prisma.category.findUnique({ where: { id } });

        return record ? toDomain(record) : null;
    }

    async listByStore(storeId: string): Promise<Category[]> {
        const records = await this.prisma.category.findMany({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
        });

        return records.map(toDomain);
    }

    async create(category: NewCategory): Promise<Category> {
        const record = await this.prisma.category.create({
        data: {
            storeId: category.storeId,
            name: category.name,
            isActive: category.isActive,
        },
        });

        return toDomain(record);
    }

    async update(category: Category): Promise<Category> {
        const record = await this.prisma.category.update({
        where: { id: category.id },
        data: {
            name: category.name,
            isActive: category.isActive,
        },
        });

        return toDomain(record);
    }
}