import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { CustomerRepositoryPort } from '../application/ports';
import type { Customer, NewCustomer } from '../domain/customer';

type CustomerRecord = {
    id: string;
    name: string;
    email: string;
};

function toDomain(record: CustomerRecord): Customer {
    return {
        id: record.id,
        name: record.name,
        email: record.email,
    };
}

export class PrismaCustomerRepository implements CustomerRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async findById(id: string): Promise<Customer | null> {
        const record = await this.prisma.customer.findUnique({
            where: { id },
        });

        return record ? toDomain(record) : null;
    }

    async create(customer: NewCustomer): Promise<Customer> {
        try {
            const record = await this.prisma.customer.create({
                data: {
                    name: customer.name,
                    email: customer.email,
                },
            });

            return toDomain(record);
        } catch (error) {
            const isUniqueViolation =
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002';

            if (isUniqueViolation) {
                throw new DomainError(
                    'CUSTOMER_EMAIL_ALREADY_EXISTS',
                    'El email del customer ya existe',
                );
            }

            throw error;
        }
    }
}