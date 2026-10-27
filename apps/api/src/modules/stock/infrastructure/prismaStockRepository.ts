import { getPrisma } from '../../../infrastructure/database/prisma';
import { AdditionStock, ProductStock } from '../domain/stock';
import { ReserveStockItemInput, StockRepository } from '../domain/stockRepository';

export class PrismaStockRepository implements StockRepository {
  async getProductStock(storeId: string, productId: string): Promise<ProductStock | null> {
    const prisma = getPrisma();
    const stock = await prisma.productStock.findUnique({
      where: { productId },
    });

    if (!stock || stock.storeId !== storeId) return null;
    return stock;
  }

  async getAdditionStock(storeId: string, additionId: string): Promise<AdditionStock | null> {
    const prisma = getPrisma();
    const stock = await prisma.additionStock.findUnique({
      where: { additionId },
    });

    if (!stock || stock.storeId !== storeId) return null;
    return stock;
  }

  async hasSufficientStock(storeId: string, items: ReserveStockItemInput[]): Promise<boolean> {
    const prisma = getPrisma();

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
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.productId) {
          const pStock = await tx.productStock.findUnique({
            where: { productId: item.productId },
          });

          if (pStock && pStock.storeId === storeId) {
            if (pStock.availableStock < item.quantity) {
              throw new Error(`Stock insuficiente para el producto ${item.productId}`);
            }

            await tx.productStock.update({
              where: { productId: item.productId },
              data: {
                availableStock: { decrement: item.quantity },
                reservedStock: { increment: item.quantity },
              },
            });

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

              await tx.additionStock.update({
                where: { additionId: addId },
                data: {
                  availableStock: { decrement: item.quantity },
                  reservedStock: { increment: item.quantity },
                },
              });

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
    });
  }

  async releaseStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
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
    });
  }

  async fulfillStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
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
    });
  }

  async setProductStock(storeId: string, productId: string, availableQuantity: number): Promise<ProductStock> {
    const prisma = getPrisma();

    const record = await prisma.productStock.upsert({
      where: { productId },
      create: {
        storeId,
        productId,
        availableStock: availableQuantity,
        reservedStock: 0,
      },
      update: {
        availableStock: availableQuantity,
      },
    });

    await prisma.stockMovement.create({
      data: {
        storeId,
        productId,
        quantity: availableQuantity,
        type: 'INVENTORY_ADJUSTMENT',
      },
    });

    return record;
  }

  async setAdditionStock(storeId: string, additionId: string, availableQuantity: number): Promise<AdditionStock> {
    const prisma = getPrisma();

    const record = await prisma.additionStock.upsert({
      where: { additionId },
      create: {
        storeId,
        additionId,
        availableStock: availableQuantity,
        reservedStock: 0,
      },
      update: {
        availableStock: availableQuantity,
      },
    });

    await prisma.stockMovement.create({
      data: {
        storeId,
        additionId,
        quantity: availableQuantity,
        type: 'INVENTORY_ADJUSTMENT',
      },
    });

    return record;
  }
}