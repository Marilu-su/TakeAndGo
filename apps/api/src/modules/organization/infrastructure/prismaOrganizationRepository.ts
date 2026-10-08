import type { PrismaClient } from '../../../generated/prisma/client';
import type { OrganizationRepositoryPort } from '../application/ports';
import type { Organization } from '../domain/organization';

type OrganizationRecord = {
    id: string;
    name: string;
    maxAdvanceDays: number;
};

function toDomain(record: OrganizationRecord): Organization {
    return {
        id: record.id,
        name: record.name,
        maxAdvanceDays: record.maxAdvanceDays,
    };
}

export class PrismaOrganizationRepository implements OrganizationRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Organization | null> {
        const record = await this.prisma.organization.findUnique({ where: { id } });

        return record ? toDomain(record) : null;
    }

    async updateMaxAdvanceDays(id: string, maxAdvanceDays: number): Promise<Organization> {
        const record = await this.prisma.organization.update({
        where: { id },
        data: { maxAdvanceDays },
        });

        return toDomain(record);
    }
}