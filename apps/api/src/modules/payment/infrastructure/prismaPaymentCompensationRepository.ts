
import { getPrisma } from '../../../infrastructure/database/prisma';

export class PrismaPaymentCompensationRepository {
 
async tryCreatePending(paymentId: string): Promise<boolean> {
  const prisma = getPrisma();

  try {
    await prisma.paymentCompensation.create({
      data: {
        paymentId,
        status: 'PENDING',
      },
    });

    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return false;
    }

    throw error;
  }
}


  async findByPaymentId(paymentId: string) {
    const prisma = getPrisma();

    return prisma.paymentCompensation.findUnique({
      where: { paymentId },
    });
  }

  async markCompleted(
    paymentId: string,
    providerRefundId: string,
  ) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const compensation = await tx.paymentCompensation.findUnique({
        where: { paymentId },
      });

      if (!compensation) {
        throw new Error('COMPENSATION_NOT_FOUND');
      }

      if (compensation.status === 'COMPLETED') {
        if (compensation.providerRefundId !== providerRefundId) {
          throw new Error('COMPENSATION_CONFLICT');
        }

        return compensation;
      }

      const updated = await tx.paymentCompensation.updateMany({
        where: {
          paymentId,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          providerRefundId,
        },
      });

      if (updated.count !== 1) {
        throw new Error('COMPENSATION_STATE_CONFLICT');
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED' },
      });

      return tx.paymentCompensation.findUniqueOrThrow({
        where: { paymentId },
      });
    });
  }
}
