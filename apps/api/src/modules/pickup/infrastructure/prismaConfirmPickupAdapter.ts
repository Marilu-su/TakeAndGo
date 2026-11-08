
import { createHash } from 'node:crypto';

import { getPrisma } from '../../../infrastructure/database/prisma';

import type {
  ConfirmPickupInput,
  ConfirmPickupPort,
  ConfirmPickupResult,
} from '../application/confirmPickupPort';

export class PrismaConfirmPickupAdapter
  implements ConfirmPickupPort
{
  async confirm(
    input: ConfirmPickupInput
  ): Promise<ConfirmPickupResult> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          items: {
            include: { additions: true },
          },
        },
      });

      if (!order || order.storeId !== input.storeId) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const credentialValue =
        input.credential.type === 'QR'
          ? input.credential.token
          : input.credential.code;

      const credentialHash = createHash('sha256')
        .update(credentialValue)
        .digest('hex');

      // Reintento idempotente:
      // no modificar auditoría ni volver a consumir stock.
      if (order.status === 'COMPLETED') {
        if (
          !order.pickedUpAt ||
          order.pickupMethod !== input.credential.type
        ) {
          throw new Error('ORDER_NOT_READY_FOR_PICKUP');
        }

        if (input.credential.type === 'MANUAL') {
          if (order.pickupCode !== credentialHash) {
            throw new Error('INVALID_PICKUP_CODE');
          }
        } else {
          // Solo es un reintento válido si ese QR
          // ya fue consumido en la entrega anterior.
          const usedToken = await tx.pickupToken.findFirst({
            where: {
              orderId: order.id,
              storeId: input.storeId,
              tokenHash: credentialHash,
              usedAt: { not: null },
            },
          });

          if (!usedToken) {
            throw new Error(
              'INVALID_OR_EXPIRED_PICKUP_TOKEN'
            );
          }
        }

        return {
          orderId: order.id,
          storeId: order.storeId,
          status: 'COMPLETED',
          pickedUpAt: order.pickedUpAt,
        };
      }

      if (order.status !== 'READY_FOR_PICKUP') {
        throw new Error('ORDER_NOT_READY_FOR_PICKUP');
      }

      // Verificar la credencial del retiro.
      if (input.credential.type === 'MANUAL') {
        if (
          !order.pickupCode ||
          order.pickupCode !== credentialHash
        ) {
          throw new Error('INVALID_PICKUP_CODE');
        }
      } else {
        const consumed = await tx.pickupToken.updateMany({
          where: {
            orderId: order.id,
            storeId: input.storeId,
            tokenHash: credentialHash,
            usedAt: null,
            expiresAt: {
              gt: input.now,
            },
          },
          data: {
            usedAt: input.now,
          },
        });

        if (consumed.count !== 1) {
          throw new Error(
            'INVALID_OR_EXPIRED_PICKUP_TOKEN'
          );
        }
      }

      // Solo un retiro modifica el estado del pedido.
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          storeId: input.storeId,
          status: 'READY_FOR_PICKUP',
          pickedUpAt: null,
        },
        data: {
          status: 'COMPLETED',
          pickedUpAt: input.now,
          pickedUpByUserId: input.employeeUserId,
          pickupMethod: input.credential.type,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error('ORDER_PICKUP_CONFLICT');
      }

      // Consumir el stock reservado en la misma transacción.
      for (const item of order.items) {
        if (item.productId) {
          const updated = await tx.productStock.updateMany({
            where: {
              storeId: input.storeId,
              productId: item.productId,
              reservedStock: {
                gte: item.quantity,
              },
            },
            data: {
              reservedStock: {
                decrement: item.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error('STOCK_RESERVATION_CONFLICT');
          }

          await tx.stockMovement.create({
            data: {
              storeId: input.storeId,
              productId: item.productId,
              quantity: item.quantity,
              type: 'ORDER_FULFILLED',
              referenceId: order.id,
            },
          });
        }

        for (const addition of item.additions) {
          if (!addition.additionId) {
            continue;
          }

          const updated = await tx.additionStock.updateMany({
            where: {
              storeId: input.storeId,
              additionId: addition.additionId,
              reservedStock: {
                gte: addition.quantity,
              },
            },
            data: {
              reservedStock: {
                decrement: addition.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error('STOCK_RESERVATION_CONFLICT');
          }

          await tx.stockMovement.create({
            data: {
              storeId: input.storeId,
              additionId: addition.additionId,
              quantity: addition.quantity,
              type: 'ORDER_FULFILLED',
              referenceId: order.id,
            },
          });
        }
      }

      return {
        orderId: order.id,
        storeId: order.storeId,
        status: 'COMPLETED',
        pickedUpAt: input.now,
      };
    });
  }
}
