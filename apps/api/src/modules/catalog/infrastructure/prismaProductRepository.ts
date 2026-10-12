import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { ProductRepositoryPort } from '../application/ports';
import type { NewProduct, Product } from '../domain/product';

type ProductRecord = {
    id: string;
    storeId: string;
    categoryId: string;
    name: string;
    description: string | null;
    priceCents: number;
    basePreparationSeconds: number;
    isActive: boolean;
};

function toDomain(record: ProductRecord): Product {
    return {
        id: record.id,
        storeId: record.storeId,
        categoryId: record.categoryId,
        name: record.name,
        description: record.description,
        priceCents: record.priceCents,
        basePreparationSeconds: record.basePreparationSeconds,
        isActive: record.isActive,
    };
}

function isForeignKeyViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

export class PrismaProductRepository implements ProductRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Product | null> {
        const record = await this.prisma.product.findUnique({ where: { id } });

        return record ? toDomain(record) : null;
    }

    async listByStore(storeId: string): Promise<Product[]> {
        const records = await this.prisma.product.findMany({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
        });

        return records.map(toDomain);
    }

    async create(product: NewProduct): Promise<Product> {
        try {
        const record = await this.prisma.product.create({
            data: {
            storeId: product.storeId,
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            priceCents: product.priceCents,
            basePreparationSeconds: product.basePreparationSeconds,
            isActive: product.isActive,
            },
        });

        return toDomain(record);
        } catch (error) {
        if (isForeignKeyViolation(error)) {
            throw new DomainError('INVALID_CATEGORY_SCOPE', 'La categoría no pertenece a este buffet');
        }

        throw error;
        }
    }

    async update(product: Product): Promise<Product> {
        try {
        const record = await this.prisma.product.update({
            where: { id: product.id },
            data: {
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            priceCents: product.priceCents,
            basePreparationSeconds: product.basePreparationSeconds,
            isActive: product.isActive,
            },
        });

        return toDomain(record);
        } catch (error) {
        if (isForeignKeyViolation(error)) {
            throw new DomainError('INVALID_CATEGORY_SCOPE', 'La categoría no pertenece a este buffet');
        }

        throw error;
        }
    }
}