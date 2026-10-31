
import { getPrisma } from '../../../infrastructure/database/prisma';

import type { Payment } from '../domain/payment';
import type {
  CreatePaymentInput,
  PaymentRepository,
} from '../domain/paymentRepository';

export class PrismaPaymentRepository implements PaymentRepository {
  
async create(input: CreatePaymentInput): Promise<Payment> {
  const prisma = getPrisma();

  return prisma.payment.upsert({
    where: {
      orderId: input.orderId,
    },
    create: {
      orderId: input.orderId,
      amountCents: input.amountCents,
      expiresAt: input.expiresAt,
      providerPaymentId: input.providerPaymentId,
      status: 'PENDING',
    },
    update: {},
  });
}


  async findById(id: string): Promise<Payment | null> {
    const prisma = getPrisma();

    return prisma.payment.findUnique({
      where: { id },
    });
  }

  
async findByOrderId(orderId: string): Promise<Payment | null> {
  const prisma = getPrisma();

  return prisma.payment.findUnique({
    where: { orderId },
  });
}



  async updateProviderPaymentId(
    id: string,
    providerPaymentId: string,
  ): Promise<Payment> {
    const prisma = getPrisma();

    return prisma.payment.update({
      where: { id },
      data: { providerPaymentId },
    });
  }
  
async transitionStatus(
  id: string,
  expectedStatus: Payment['status'],
  newStatus: Payment['status'],
): Promise<Payment | null> {
  const prisma = getPrisma();

  const result = await prisma.payment.updateMany({
    where: {
      id,
      status: expectedStatus,
    },
    data: {
      status: newStatus,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return this.findById(id);
}

}
