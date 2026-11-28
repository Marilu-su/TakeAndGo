import type { Prisma } from '../../../generated/prisma/client';

/**
 * Un producto o adicional sin registro de stock en el buffet no tiene control de stock:
 * al reservar se omite (ver PrismaStockRepository.reserveStock), así que al liberar
 * o consumir tampoco hay nada que mover.
 */
export async function isUntrackedStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  ref: { productId?: string | null; additionId?: string | null },
): Promise<boolean> {
  if (ref.productId) {
    const stock = await tx.productStock.findFirst({ where: { storeId, productId: ref.productId }, select: { id: true } });
    return stock === null;
  }

  if (ref.additionId) {
    const stock = await tx.additionStock.findFirst({ where: { storeId, additionId: ref.additionId }, select: { id: true } });
    return stock === null;
  }

  return true;
}
