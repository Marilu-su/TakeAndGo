import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { CustomerStoreMembershipRepositoryPort } from '../application/ports';
import type {
    CustomerStoreMembership,
    NewCustomerStoreMembership,
} from '../domain/customerStoreMembership';

export class PrismaCustomerStoreMembershipRepository
    implements CustomerStoreMembershipRepositoryPort
{
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async create(
        membership: NewCustomerStoreMembership,
    ): Promise<CustomerStoreMembership> {
        try {
            const record = await this.prisma.customerStoreMembership.create({
                data: {
                    customerId: membership.customerId,
                    storeId: membership.storeId,
                },
            });

            return {
                customerId: record.customerId,
                storeId: record.storeId,
            };
        } catch (error) {
            const isUniqueViolation =
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002';

            if (isUniqueViolation) {
                throw new DomainError(
                    'CUSTOMER_ALREADY_ASSOCIATED_TO_STORE',
                    'El customer ya está asociado al buffet',
                );
            }

            throw error;
        }
    }

    async findByCustomerId(
        customerId: string,
    ): Promise<CustomerStoreMembership[]> {
        const records = await this.prisma.customerStoreMembership.findMany({
            where: { customerId },
        });

        return records.map((record) => ({
            customerId: record.customerId,
            storeId: record.storeId,
        }));
    }
}