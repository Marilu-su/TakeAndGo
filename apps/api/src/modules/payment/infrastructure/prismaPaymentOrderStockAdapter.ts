
import { getPrisma } from '../../../infrastructure/database/prisma';
import type {
  PaymentOrderStockPort,
  PaymentResult,
} from '../application/processPaymentResultUseCase';

export class PrismaPaymentOrderStockAdapter
  implements PaymentOrderStockPort
{
  async applyResult(
    paymentId: string,
    result: PaymentResult,
    now: Date,
  ) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          order: {
            include: {
              items: {
                include: { additions: true },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new Error('PAYMENT_NOT_FOUND');
      }

      if (payment.status === result) {
        if (
          (result === 'APPROVED' &&
            payment.order.status === 'CONFIRMED') ||
          (result === 'REJECTED' &&
            payment.order.status === 'CANCELLED')
        ) {
          return payment;
        }

        throw new Error('PAYMENT_ORDER_STATE_CONFLICT');
      }

      if (payment.status !== 'PENDING') {
        throw new Error('PAYMENT_STATE_CONFLICT');
      }

      const order = payment.order;

      if (order.status !== 'RESERVED') {
        throw new Error('ORDER_NOT_RESERVED');
      }

      if (result === 'APPROVED') {
        if (
          now >= payment.expiresAt ||
          !order.reservedUntil ||
          now >= order.reservedUntil
        ) {
          throw new Error('PAYMENT_EXPIRED');
        }
      }

      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: 'PENDING',
        },
        data: { status: result },
      });

      if (updatedPayment.count !== 1) {
        throw new Error('PAYMENT_STATE_CONFLICT');
      }

      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'RESERVED',
        },
        data: {
          status:
            result === 'APPROVED'
              ? 'CONFIRMED'
              : 'CANCELLED',
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error('ORDER_STATE_CONFLICT');
      }

      if (result === 'REJECTED') {
        for (const item of order.items) {
          if (item.productId) {
            const updated = await tx.productStock.updateMany({
              where: {
                productId: item.productId,
                storeId: order.storeId,
                reservedStock: { gte: item.quantity },
              },
              data: {
                availableStock: {
                  increment: item.quantity,
                },
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
                storeId: order.storeId,
                productId: item.productId,
                quantity: item.quantity,
                type: 'ORDER_CANCELLED',
                referenceId: order.id,
              },
            });
          }

          for (const addition of item.additions) {
            if (!addition.additionId) continue;

            const updated = await tx.additionStock.updateMany({
              where: {
                additionId: addition.additionId,
                storeId: order.storeId,
                reservedStock: { gte: addition.quantity },
              },
              data: {
                availableStock: {
                  increment: addition.quantity,
                },
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
                storeId: order.storeId,
                additionId: addition.additionId,
                quantity: addition.quantity,
                type: 'ORDER_CANCELLED',
                referenceId: order.id,
              },
            });
          }
        }
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
    });
  }

  async expireOrder(
    orderId: string,
    now: Date,
  ): Promise<boolean> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { additions: true },
          },
          payments: true,
        },
      });

      if (
        !order ||
        order.status !== 'RESERVED' ||
        !order.reservedUntil ||
        order.reservedUntil > now
      ) {
        return false;
      }

      
      if (order.payments?.status === 'APPROVED') {
        throw new Error('PAYMENT_ORDER_STATE_CONFLICT');
      }


      const changed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'RESERVED',
          reservedUntil: { lte: now },
        },
        data: { status: 'EXPIRED' },
      });

      if (changed.count !== 1) {
        return false;
      }

      for (const item of order.items) {
        if (item.productId) {
          const updated = await tx.productStock.updateMany({
            where: {
              storeId: order.storeId,
              productId: item.productId,
              reservedStock: { gte: item.quantity },
            },
            data: {
              availableStock: {
                increment: item.quantity,
              },
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
              storeId: order.storeId,
              productId: item.productId,
              quantity: item.quantity,
              type: 'ORDER_CANCELLED',
              referenceId: orderId,
            },
          });
        }

        for (const addition of item.additions) {
          if (!addition.additionId) continue;

          const updated = await tx.additionStock.updateMany({
            where: {
              storeId: order.storeId,
              additionId: addition.additionId,
              reservedStock: { gte: addition.quantity },
            },
            data: {
              availableStock: {
                increment: addition.quantity,
              },
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
              storeId: order.storeId,
              additionId: addition.additionId,
              quantity: addition.quantity,
              type: 'ORDER_CANCELLED',
              referenceId: orderId,
            },
          });
        }
      }

      return true;
    });
  }
}
