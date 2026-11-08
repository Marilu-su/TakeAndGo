
import { createHash, randomBytes } from 'node:crypto';

import { getPrisma } from '../../../infrastructure/database/prisma';

import type {
  IssuePickupTokenInput,
  IssuePickupTokenPort,
  IssuedPickupToken,
} from '../application/issuePickupTokenPort';

export class PrismaIssuePickupTokenAdapter
  implements IssuePickupTokenPort
{
  async issue(
    input: IssuePickupTokenInput
  ): Promise<IssuedPickupToken> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      // Buscar el pedido y verificar que pertenezca al cliente.
      const order = await tx.order.findFirst({
        where: {
          id: input.orderId,
          customerId: input.customerId,
        },
      });

      // Solo se pueden generar QR para pedidos listos.
      if (!order || order.status !== 'READY_FOR_PICKUP') {
        throw new Error('ORDER_NOT_AVAILABLE_FOR_PICKUP');
      }

      // Invalidar los QR anteriores que todavía estén vigentes.
      // Una nueva emisión reemplaza al QR anterior.
      await tx.pickupToken.updateMany({
        where: {
          orderId: order.id,
          storeId: order.storeId,
          usedAt: null,
          expiresAt: {
            gt: input.now,
          },
        },
        data: {
          expiresAt: input.now,
        },
      });

      // Generar un token aleatorio y seguro de 256 bits.
      const token = randomBytes(32).toString('hex');

      // Guardar únicamente el hash, nunca el token original.
      const tokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      // Vigencia provisional de 5 minutos.
      const expiresAt = new Date(
        input.now.getTime() + 5 * 60 * 1000
      );

      // Persistir el nuevo QR en PostgreSQL.
      await tx.pickupToken.create({
        data: {
          orderId: order.id,
          storeId: order.storeId,
          tokenHash,
          expiresAt,
        },
      });

      // Devolver el token original al cliente.
      return {
        token,
        expiresAt,
      };
    });
  }
}
