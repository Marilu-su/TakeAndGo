
import { createHash, randomBytes } from 'node:crypto';

import { getPrisma } from '../../../infrastructure/database/prisma';

import type {
  ManualPickupPort,
  ManualPickupResult,
  ManualPickupLookup,
} from '../application/manualPickupUseCase';

export function hashManualPickupCode(code: string): string {
  return createHash('sha256')
    .update(code)
    .digest('hex');
}

export class PrismaManualPickupAdapter
  implements ManualPickupPort
{
  async issue(
    orderId: string,
    customerId: string
  ): Promise<ManualPickupResult> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          customerId,
          status: 'READY_FOR_PICKUP',
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_AVAILABLE_FOR_PICKUP');
      }

      // 9 bytes aleatorios producen 12 caracteres base64url.
      const code = randomBytes(9).toString('base64url');

      const result = await tx.order.updateMany({
        where: {
          id: order.id,
          customerId,
          status: 'READY_FOR_PICKUP',
        },
        data: {
          pickupCode: hashManualPickupCode(code),
        },
      });

      if (result.count !== 1) {
        throw new Error('ORDER_PICKUP_CONFLICT');
      }

      return {
        orderId: order.id,
        storeId: order.storeId,
        orderNumber: order.orderNumber,
        code,
      };
    });
  }

  async findByCode(
    storeId: string,
    code: string
  ): Promise<ManualPickupLookup> {
    const prisma = getPrisma();

    const order = await prisma.order.findFirst({
      where: {
        storeId,
        pickupCode: hashManualPickupCode(code),
        status: 'READY_FOR_PICKUP',
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    return {
      orderId: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      status: 'READY_FOR_PICKUP',
    };
  }
}
