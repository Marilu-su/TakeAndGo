import type { PrismaClient } from '../../../generated/prisma/client';
import type { StaffScopeRepositoryPort } from '../application/ports';
import type { NewStaffScope, StaffRole, StaffScope } from '../domain/staffScope';

type StaffScopeRecord = {
    id: string;
    authUserId: string;
    role: StaffRole;
    organizationId: string;
    storeId: string | null;
};

function toDomain(record: StaffScopeRecord): StaffScope {
    return {
        id: record.id,
        authUserId: record.authUserId,
        role: record.role,
        organizationId: record.organizationId,
        storeId: record.storeId,
    };
}

export class PrismaStaffScopeRepository implements StaffScopeRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findByAuthUserId(authUserId: string): Promise<StaffScope | null> {
        const record = await this.prisma.staffScope.findUnique({ where: { authUserId } });

        return record ? toDomain(record) : null;
    }

    async save(scope: NewStaffScope): Promise<StaffScope> {
        const record = await this.prisma.staffScope.upsert({
        where: { authUserId: scope.authUserId },
        create: scope,
        update: {
            role: scope.role,
            organizationId: scope.organizationId,
            storeId: scope.storeId,
        },
        });

        return toDomain(record);
    }
}