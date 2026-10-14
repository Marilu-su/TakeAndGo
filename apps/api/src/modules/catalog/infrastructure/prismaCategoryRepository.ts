import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { CategoryRepositoryPort } from '../application/ports';
import { categoryNameKey, type Category, type NewCategory } from '../domain/category';

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

function activeNameKeyOf(category: { name: string; isActive: boolean }): string | null {
    return category.isActive ? categoryNameKey(category.name) : null;
}

function translateUniqueViolation(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError(
        'CATEGORY_NAME_ALREADY_EXISTS',
        'Ya existe una categoría activa con ese nombre en este buffet',
        );
    }

    throw error;
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
        try {
        const record = await this.prisma.category.create({
            data: {
            storeId: category.storeId,
            name: category.name,
            isActive: category.isActive,
            activeNameKey: activeNameKeyOf(category),
            },
        });

        return toDomain(record);
        } catch (error) {
        return translateUniqueViolation(error);
        }
    }

    async update(category: Category): Promise<Category> {
        try {
        const record = await this.prisma.category.update({
            where: { id: category.id },
            data: {
            name: category.name,
            isActive: category.isActive,
            activeNameKey: activeNameKeyOf(category),
            },
        });

        return toDomain(record);
        } catch (error) {
        return translateUniqueViolation(error);
        }
    }
}