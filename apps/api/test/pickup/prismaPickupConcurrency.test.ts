
import 'dotenv/config';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

import { getPrisma } from '../../src/infrastructure/database/prisma';
import { PrismaConfirmPickupAdapter } from '../../src/modules/pickup/infrastructure/prismaConfirmPickupAdapter';
import { PrismaIssuePickupTokenAdapter } from '../../src/modules/pickup/infrastructure/prismaIssuePickupTokenAdapter';
import { PrismaManualPickupAdapter } from '../../src/modules/pickup/infrastructure/prismaManualPickupAdapter';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
  'retiros QR y manual concurrentes consumen stock una sola vez',
  { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
  async () => {
    const prisma = getPrisma();
    const confirmAdapter = new PrismaConfirmPickupAdapter();
    const qrAdapter = new PrismaIssuePickupTokenAdapter();
    const manualAdapter = new PrismaManualPickupAdapter();
    const unique = randomUUID();

    const organization = await prisma.organization.create({
      data: {
        name: `Organización concurrencia ${unique}`,
      },
    });

    let storeId: string | undefined;
    let customerId: string | undefined;
    let categoryId: string | undefined;
    let productId: string | undefined;

    try {
      // Crear buffet, cliente y producto de prueba.
      const store = await prisma.store.create({
        data: {
          organizationId: organization.id,
          name: 'Buffet concurrencia',
          code: `PCO${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0')}`,
        },
      });

      storeId = store.id;

      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente concurrencia',
          email: `concurrency-${unique}@example.com`,
        },
      });

      customerId = customer.id;

      const category = await prisma.category.create({
        data: {
          storeId,
          name: 'Concurrencia',
          activeNameKey: `concurrency-${unique}`,
        },
      });

      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          storeId,
          categoryId,
          name: 'Producto concurrencia',
          priceCents: 1000,
          basePreparationSeconds: 60,
        },
      });

      productId = product.id;

      // Una unidad reservada para cada pedido.
      await prisma.productStock.create({
        data: {
          storeId,
          productId,
          availableStock: 0,
          reservedStock: 2,
        },
      });

      const now = new Date();

      // =============================================
      // PRUEBA 1: DOS CONFIRMACIONES QR SIMULTÁNEAS
      // =============================================

      const qrOrder = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 1,
          status: 'READY_FOR_PICKUP',
          totalCents: 1000,
          items: {
            create: {
              productId,
              productNameSnapshot: product.name,
              unitPriceCentsSnapshot: 1000,
              quantity: 1,
              subtotalCents: 1000,
            },
          },
        },
      });

      // Primero se emite un QR normal.
      const firstQr = await qrAdapter.issue({
        orderId: qrOrder.id,
        customerId,
        now,
      });

      // El cliente solicita dos QR al mismo tiempo.
      const issueResults = await Promise.allSettled([
        qrAdapter.issue({
          orderId: qrOrder.id,
          customerId,
          now,
        }),
        qrAdapter.issue({
          orderId: qrOrder.id,
          customerId,
          now,
        }),
      ]);

      // Al menos una emisión debe completarse.
      const successfulIssues = issueResults
        .filter(
          (result): result is PromiseFulfilledResult<
            Awaited<ReturnType<typeof qrAdapter.issue>>
          > => result.status === 'fulfilled'
        )
        .map((result) => result.value);

      assert.ok(
        successfulIssues.length >= 1,
        'Ninguna emisión simultánea pudo completarse'
      );

      // Solo puede quedar un token vigente para el pedido.
      const activeTokens = await prisma.pickupToken.findMany({
        where: {
          orderId: qrOrder.id,
          storeId,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
      });

      assert.equal(
        activeTokens.length,
        1,
        'Hay más de un QR vigente para el mismo pedido'
      );

      // La primera emisión ya debe estar invalidada.
      const firstQrHash = createHash('sha256')
        .update(firstQr.token)
        .digest('hex');

      assert.notEqual(
        activeTokens[0].tokenHash,
        firstQrHash,
        'El QR anterior sigue vigente'
      );

      // Recuperar el token válido entre las emisiones.
      const qr = successfulIssues.find((issued) => {
        const hash = createHash('sha256')
          .update(issued.token)
          .digest('hex');

        return hash === activeTokens[0].tokenHash;
      });

      assert.ok(
        qr,
        'No se pudo identificar el QR vigente'
      );


      const qrInput = {
        storeId,
        orderId: qrOrder.id,
        employeeUserId: 'employee-test',
        credential: {
          type: 'QR' as const,
          token: qr.token,
        },
        now,
      };

      const qrResults = await Promise.allSettled([
        confirmAdapter.confirm(qrInput),
        confirmAdapter.confirm(qrInput),
      ]);

      // Al menos una confirmación debe resultar exitosa.
      assert.ok(
        qrResults.some(
          (result) => result.status === 'fulfilled'
        )
      );

      const completedQr =
        await prisma.order.findUniqueOrThrow({
          where: { id: qrOrder.id },
        });

      assert.equal(completedQr.status, 'COMPLETED');
      assert.equal(completedQr.pickupMethod, 'QR');

      // El movimiento de stock no debe duplicarse.
      assert.equal(
        await prisma.stockMovement.count({
          where: {
            referenceId: qrOrder.id,
            type: 'ORDER_FULFILLED',
          },
        }),
        1
      );

      // Un reintento posterior devuelve el estado existente.
      const qrRetry = await confirmAdapter.confirm(qrInput);

      assert.equal(qrRetry.status, 'COMPLETED');
      assert.deepEqual(
        qrRetry.pickedUpAt,
        completedQr.pickedUpAt
      );

      // =============================================
      // PRUEBA 2: DOS CONFIRMACIONES MANUALES SIMULTÁNEAS
      // =============================================

      const manualOrder = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 2,
          status: 'READY_FOR_PICKUP',
          totalCents: 1000,
          items: {
            create: {
              productId,
              productNameSnapshot: product.name,
              unitPriceCentsSnapshot: 1000,
              quantity: 1,
              subtotalCents: 1000,
            },
          },
        },
      });

      const manual = await manualAdapter.issue(
        manualOrder.id,
        customerId
      );

      const manualInput = {
        storeId,
        orderId: manualOrder.id,
        employeeUserId: 'employee-test',
        credential: {
          type: 'MANUAL' as const,
          code: manual.code,
        },
        now,
      };

      const manualResults = await Promise.allSettled([
        confirmAdapter.confirm(manualInput),
        confirmAdapter.confirm(manualInput),
      ]);

      // Al menos una confirmación debe ser exitosa.
      assert.ok(
        manualResults.some(
          (result) => result.status === 'fulfilled'
        )
      );

      const completedManual =
        await prisma.order.findUniqueOrThrow({
          where: { id: manualOrder.id },
        });

      assert.equal(completedManual.status, 'COMPLETED');
      assert.equal(completedManual.pickupMethod, 'MANUAL');

      // El retiro manual tampoco puede duplicar el stock.
      assert.equal(
        await prisma.stockMovement.count({
          where: {
            referenceId: manualOrder.id,
            type: 'ORDER_FULFILLED',
          },
        }),
        1
      );

      // El reintento manual debe ser idempotente.
      const manualRetry =
        await confirmAdapter.confirm(manualInput);

      assert.equal(manualRetry.status, 'COMPLETED');
      assert.deepEqual(
        manualRetry.pickedUpAt,
        completedManual.pickedUpAt
      );

      // =============================================
      // VERIFICACIONES FINALES
      // =============================================

      const finalStock =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      // Se consumió una unidad por cada pedido.
      assert.equal(finalStock.reservedStock, 0);

      // Exactamente dos movimientos:
      // uno QR y uno MANUAL.
      assert.equal(
        await prisma.stockMovement.count({
          where: {
            storeId,
            type: 'ORDER_FULFILLED',
            referenceId: {
              in: [qrOrder.id, manualOrder.id],
            },
          },
        }),
        2
      );
    } finally {
      // Limpiar los registros creados para el test.
      if (storeId) {
        await prisma.stockMovement.deleteMany({
          where: { storeId },
        });

        await prisma.pickupToken.deleteMany({
          where: { storeId },
        });

        await prisma.order.deleteMany({
          where: { storeId },
        });
      }

      if (productId) {
        await prisma.productStock.deleteMany({
          where: { productId },
        });

        await prisma.product.delete({
          where: { id: productId },
        });
      }

      if (categoryId) {
        await prisma.category.delete({
          where: { id: categoryId },
        });
      }

      if (customerId) {
        await prisma.customer.delete({
          where: { id: customerId },
        });
      }

      if (storeId) {
        await prisma.store.delete({
          where: { id: storeId },
        });
      }

      await prisma.organization.delete({
        where: { id: organization.id },
      });
    }
  }
);
