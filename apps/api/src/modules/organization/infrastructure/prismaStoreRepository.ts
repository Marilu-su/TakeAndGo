import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { StoreRepositoryPort } from '../application/ports';
import type { NewStore, Store, StoreStatus } from '../domain/store';
import type { StoreCode } from '../domain/storeCode';

type StoreRecord = {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    status: StoreStatus;
};

function toDomain(record: StoreRecord): Store {
    return {
        id: record.id,
        organizationId: record.organizationId,
        name: record.name,
        code: record.code as StoreCode,
        status: record.status,
    };
}

export class PrismaStoreRepository implements StoreRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Store | null> {
        const record = await this.prisma.store.findUnique({ where: { id } });

        return record ? toDomain(record) : null;
    }

    async create(store: NewStore): Promise<Store> {
        try {
        const record = await this.prisma.store.create({
            data: {
            organizationId: store.organizationId,
            name: store.name,
            code: store.code,
            status: store.status,
            },
        });

        return toDomain(record);
        } catch (error) {
        const isUniqueViolation =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

        if (isUniqueViolation) {
            throw new DomainError('STORE_CODE_ALREADY_EXISTS', 'El código del buffet ya existe');
        }

        throw error;
        }
    }

    async updateStatus(id: string, status: StoreStatus): Promise<Store> {
        const record = await this.prisma.store.update({
        where: { id },
        data: { status },
        });

        return toDomain(record);
    }
}