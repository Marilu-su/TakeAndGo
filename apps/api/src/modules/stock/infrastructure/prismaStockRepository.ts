import { getPrisma } from '../../../infrastructure/database/prisma';
import { AdditionStock, ProductStock } from '../domain/stock';
import { ReserveStockItemInput, StockRepository } from '../domain/stockRepository';
import type { Prisma } from '../../../generated/prisma/client';

export class PrismaStockRepository implements StockRepository {
  constructor(private readonly transaction?: Prisma.TransactionClient) {}
  async getProductStock(storeId: string, productId: string): Promise<ProductStock | null> {
    const prisma = this.transaction ?? getPrisma();
    const stock = await prisma.productStock.findUnique({
      where: { productId },
    });

    if (!stock || stock.storeId !== storeId) return null;
    return stock;
  }

  async getAdditionStock(storeId: string, additionId: string): Promise<AdditionStock | null> {
    const prisma = this.transaction ?? getPrisma();
    const stock = await prisma.additionStock.findUnique({
      where: { additionId },
    });

    if (!stock || stock.storeId !== storeId) return null;
    return stock;
  }

  async hasSufficientStock(storeId: string, items: ReserveStockItemInput[]): Promise<boolean> {
    const prisma = this.transaction ?? getPrisma();

    for (const item of items) {
      if (item.productId) {
        const prodStock = await prisma.productStock.findUnique({
          where: { productId: item.productId },
        });

        if (prodStock && prodStock.storeId === storeId) {
          if (prodStock.availableStock < item.quantity) {
            return false;
          }
        }
      }

      if (item.additionIds && item.additionIds.length > 0) {
        for (const addId of item.additionIds) {
          const addStock = await prisma.additionStock.findUnique({
            where: { additionId: addId },
          });

          if (addStock && addStock.storeId === storeId) {
            if (addStock.availableStock < item.quantity) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  async reserveStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (item.productId) {
          const pStock = await tx.productStock.findUnique({
            where: { productId: item.productId },
          });

          if (pStock && pStock.storeId === storeId) {
            if (pStock.availableStock < item.quantity) {
              throw new Error(`Stock insuficiente para el producto ${item.productId}`);
            }

            const reserved = await tx.productStock.updateMany({
              where: { productId: item.productId, storeId, availableStock: { gte: item.quantity } },
              data: {
                availableStock: { decrement: item.quantity },
                reservedStock: { increment: item.quantity },
              },
            });

            if (reserved.count !== 1) throw new Error("Stock insuficiente para completar el pedido");
            await tx.stockMovement.create({
              data: {
                storeId,
                productId: item.productId,
                quantity: -item.quantity,
                type: 'ORDER_RESERVED',
                referenceId: orderId,
              },
            });
          }
        }

        if (item.additionIds) {
          for (const addId of item.additionIds) {
            const aStock = await tx.additionStock.findUnique({
              where: { additionId: addId },
            });

            if (aStock && aStock.storeId === storeId) {
              if (aStock.availableStock < item.quantity) {
                throw new Error(`Stock insuficiente para el adicional ${addId}`);
              }

              const reserved = await tx.additionStock.updateMany({
                where: { additionId: addId, storeId, availableStock: { gte: item.quantity } },
                data: {
                  availableStock: { decrement: item.quantity },
                  reservedStock: { increment: item.quantity },
                },
              });

              if (reserved.count !== 1) throw new Error("Stock insuficiente para completar el pedido");
              await tx.stockMovement.create({
                data: {
                  storeId,
                  additionId: addId,
                  quantity: -item.quantity,
                  type: 'ORDER_RESERVED',
                  referenceId: orderId,
                },
              });
            }
          }
        }
      }
    };
    if (this.transaction) await execute(this.transaction);
    else await getPrisma().$transaction(execute);
  }

  async releaseStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (item.productId) {
          const pStock = await tx.productStock.findUnique({
            where: { productId: item.productId },
          });

          if (pStock && pStock.storeId === storeId) {
            await tx.productStock.update({
              where: { productId: item.productId },
              data: {
                availableStock: { increment: item.quantity },
                reservedStock: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                storeId,
                productId: item.productId,
                quantity: item.quantity,
                type: 'ORDER_CANCELLED',
                referenceId: orderId,
              },
            });
          }
        }

        if (item.additionIds) {
          for (const addId of item.additionIds) {
            const aStock = await tx.additionStock.findUnique({
              where: { additionId: addId },
            });

            if (aStock && aStock.storeId === storeId) {
              await tx.additionStock.update({
                where: { additionId: addId },
                data: {
                  availableStock: { increment: item.quantity },
                  reservedStock: { decrement: item.quantity },
                },
              });

              await tx.stockMovement.create({
                data: {
                  storeId,
                  additionId: addId,
                  quantity: item.quantity,
                  type: 'ORDER_CANCELLED',
                  referenceId: orderId,
                },
              });
            }
          }
        }
      }
    };
    if (this.transaction) await execute(this.transaction);
    else await getPrisma().$transaction(execute);
  }

  async fulfillStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (item.productId) {
          const pStock = await tx.productStock.findUnique({
            where: { productId: item.productId },
          });

          if (pStock && pStock.storeId === storeId) {
            await tx.productStock.update({
              where: { productId: item.productId },
              data: {
                reservedStock: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                storeId,
                productId: item.productId,
                quantity: item.quantity,
                type: 'ORDER_FULFILLED',
                referenceId: orderId,
              },
            });
          }
        }

        if (item.additionIds) {
          for (const addId of item.additionIds) {
            const aStock = await tx.additionStock.findUnique({
              where: { additionId: addId },
            });

            if (aStock && aStock.storeId === storeId) {
              await tx.additionStock.update({
                where: { additionId: addId },
                data: {
                  reservedStock: { decrement: item.quantity },
                },
              });

              await tx.stockMovement.create({
                data: {
                  storeId,
                  additionId: addId,
                  quantity: item.quantity,
                  type: 'ORDER_FULFILLED',
                  referenceId: orderId,
                },
              });
            }
          }
        }
      }
    };
    if (this.transaction) await execute(this.transaction);
    else await getPrisma().$transaction(execute);
  }

  async setProductStock(storeId: string, productId: string, availableQuantity: number, reason: string, actorUserId: string): Promise<ProductStock> {
    const adjust = async (tx: Prisma.TransactionClient) => {
      const current = await tx.productStock.findUnique({ where: { productId } });
      if (current && current.storeId !== storeId) throw new Error('El producto no pertenece a este buffet.');
      const difference = availableQuantity - (current?.availableStock ?? 0);
      const record = await tx.productStock.upsert({ where: { productId }, create: { storeId, productId, availableStock: availableQuantity, reservedStock: 0 }, update: { availableStock: availableQuantity } });
      await tx.stockMovement.create({ data: { storeId, productId, quantity: difference, type: 'INVENTORY_ADJUSTMENT', reason, actorUserId } });
      return record;
    };
    return this.transaction ? adjust(this.transaction) : getPrisma().$transaction(adjust);
  }

  async setAdditionStock(storeId: string, additionId: string, availableQuantity: number, reason: string, actorUserId: string): Promise<AdditionStock> {
    const adjust = async (tx: Prisma.TransactionClient) => {
      const current = await tx.additionStock.findUnique({ where: { additionId } });
      if (current && current.storeId !== storeId) throw new Error('El adicional no pertenece a este buffet.');
      const difference = availableQuantity - (current?.availableStock ?? 0);
      const record = await tx.additionStock.upsert({ where: { additionId }, create: { storeId, additionId, availableStock: availableQuantity, reservedStock: 0 }, update: { availableStock: availableQuantity } });
      await tx.stockMovement.create({ data: { storeId, additionId, quantity: difference, type: 'INVENTORY_ADJUSTMENT', reason, actorUserId } });
      return record;
    };
    return this.transaction ? adjust(this.transaction) : getPrisma().$transaction(adjust);
  }
}
