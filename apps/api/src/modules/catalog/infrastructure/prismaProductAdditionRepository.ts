import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { DomainError } from '../../../shared/domain/DomainError';
import type { ProductAdditionRepositoryPort } from '../application/ports';

export class PrismaProductAdditionRepository implements ProductAdditionRepositoryPort {
    private readonly prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async listAdditionIds(productId: string): Promise<string[]> {
        const links = await this.prisma.productAddition.findMany({
        where: { productId },
        select: { additionId: true },
        });

        return links.map((link) => link.additionId);
    }

    async replace(productId: string, storeId: string, additionIds: string[]): Promise<void> {
        try {
        await this.prisma.$transaction([
            this.prisma.productAddition.deleteMany({ where: { productId } }),
            this.prisma.productAddition.createMany({
            data: additionIds.map((additionId) => ({ productId, additionId, storeId })),
            }),
        ]);
        } catch (error) {
        const isForeignKeyViolation =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

        if (isForeignKeyViolation) {
            throw new DomainError('INVALID_ADDITION_SCOPE', 'Uno de los adicionales no pertenece a este buffet');
        }

        throw error;
        }
    }
}