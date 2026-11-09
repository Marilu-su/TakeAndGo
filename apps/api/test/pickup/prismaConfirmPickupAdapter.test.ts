
import 'dotenv/config';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

import { getPrisma } from '../../src/infrastructure/database/prisma';
import { PrismaConfirmPickupAdapter } from '../../src/modules/pickup/infrastructure/prismaConfirmPickupAdapter';
import { PrismaIssuePickupTokenAdapter } from '../../src/modules/pickup/infrastructure/prismaIssuePickupTokenAdapter';
import {
  PrismaManualPickupAdapter,
  hashManualPickupCode,
} from '../../src/modules/pickup/infrastructure/prismaManualPickupAdapter';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
  'integra retiro QR y manual con PostgreSQL, stock y auditoría',
  { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
  async () => {
    const prisma = getPrisma();

    const confirmAdapter = new PrismaConfirmPickupAdapter();
    const qrAdapter = new PrismaIssuePickupTokenAdapter();
    const manualAdapter = new PrismaManualPickupAdapter();

    const unique = randomUUID();

    const organization = await prisma.organization.create({
      data: {
        name: `Organización pickup ${unique}`,
      },
    });

    let storeId: string | undefined;
    let customerId: string | undefined;
    let categoryId: string | undefined;
    let productId: string | undefined;

    try {
      // Preparar los datos de prueba.
      const store = await prisma.store.create({
        data: {
          organizationId: organization.id,
          name: 'Buffet de prueba pickup',
          code: `PUP${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0')}`,
        },
      });

      storeId = store.id;

      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente pickup test',
          email: `pickup-${unique}@example.com`,
        },
      });

      customerId = customer.id;

      const category = await prisma.category.create({
        data: {
          storeId,
          name: 'Prueba pickup',
          activeNameKey: `pickup-${unique}`,
        },
      });

      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          storeId,
          categoryId,
          name: 'Producto de prueba',
          priceCents: 1000,
          basePreparationSeconds: 60,
        },
      });

      productId = product.id;

      await prisma.productStock.create({
        data: {
          storeId,
          productId,
          availableStock: 0,
          reservedStock: 2,
        },
      });

      const now = new Date();

      // ==================================================
      // PRUEBA 1: GENERACIÓN Y CONFIRMACIÓN POR QR
      // ==================================================

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

      // Un cliente ajeno no puede generar el QR.
      await assert.rejects(
        () =>
          qrAdapter.issue({
            orderId: qrOrder.id,
            customerId: randomUUID(),
            now,
          }),
        /ORDER_NOT_AVAILABLE_FOR_PICKUP/
      );

      const firstQr = await qrAdapter.issue({
        orderId: qrOrder.id,
        customerId,
        now,
      });

      const firstHash = createHash('sha256')
        .update(firstQr.token)
        .digest('hex');

      const storedFirstQr =
        await prisma.pickupToken.findUniqueOrThrow({
          where: { tokenHash: firstHash },
        });

      assert.equal(storedFirstQr.usedAt, null);
      assert.notEqual(storedFirstQr.tokenHash, firstQr.token);

      assert.equal(
        firstQr.expiresAt.getTime(),
        now.getTime() + 5 * 60 * 1000
      );

      // Reemitir el QR invalida el anterior.
      const secondQr = await qrAdapter.issue({
        orderId: qrOrder.id,
        customerId,
        now,
      });

      assert.notEqual(firstQr.token, secondQr.token);

      const secondHash = createHash('sha256')
        .update(secondQr.token)
        .digest('hex');

      const invalidatedQr =
        await prisma.pickupToken.findUniqueOrThrow({
          where: { tokenHash: firstHash },
        });

      assert.deepEqual(invalidatedQr.expiresAt, now);
      assert.equal(invalidatedQr.usedAt, null);

      const qrInput = {
        storeId,
        orderId: qrOrder.id,
        employeeUserId: 'employee-test',
        credential: {
          type: 'QR' as const,
          token: secondQr.token,
        },
        now,
      };

      // El QR anterior debe ser rechazado.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...qrInput,
            credential: {
              type: 'QR',
              token: firstQr.token,
            },
          }),
        /INVALID_OR_EXPIRED_PICKUP_TOKEN/
      );

      // Un token inventado no debe funcionar.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...qrInput,
            credential: {
              type: 'QR',
              token: 'token-invalido',
            },
          }),
        /INVALID_OR_EXPIRED_PICKUP_TOKEN/
      );

      // El QR nuevo tampoco funciona cuando vence.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...qrInput,
            now: secondQr.expiresAt,
          }),
        /INVALID_OR_EXPIRED_PICKUP_TOKEN/
      );

      // Un buffet distinto no puede confirmar.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...qrInput,
            storeId: randomUUID(),
          }),
        /ORDER_NOT_FOUND/
      );

      // Las pruebas negativas no consumieron el QR.
      const stillActive =
        await prisma.pickupToken.findUniqueOrThrow({
          where: { tokenHash: secondHash },
        });

      assert.equal(stillActive.usedAt, null);

      // Confirmar correctamente el retiro por QR.
      const qrResult = await confirmAdapter.confirm(
        qrInput
      );

      assert.equal(qrResult.status, 'COMPLETED');

      const completedQrOrder =
        await prisma.order.findUniqueOrThrow({
          where: { id: qrOrder.id },
        });

      assert.equal(
        completedQrOrder.status,
        'COMPLETED'
      );
      assert.equal(completedQrOrder.pickupMethod, 'QR');
      assert.deepEqual(completedQrOrder.pickedUpAt, now);
      assert.equal(
        completedQrOrder.pickedUpByUserId,
        'employee-test'
      );

      const usedQr =
        await prisma.pickupToken.findUniqueOrThrow({
          where: { tokenHash: secondHash },
        });

      assert.deepEqual(usedQr.usedAt, now);

      // No permitir un segundo retiro.
      const repeatedQrResult =
  await confirmAdapter.confirm(qrInput);

assert.equal(repeatedQrResult.status, 'COMPLETED');
assert.deepEqual(
  repeatedQrResult.pickedUpAt,
  completedQrOrder.pickedUpAt
);
      assert.equal(
        await prisma.stockMovement.count({
          where: {
            referenceId: qrOrder.id,
            type: 'ORDER_FULFILLED',
          },
        }),
        1
      );

      const stockAfterQr =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      assert.equal(stockAfterQr.reservedStock, 1);

      // ==================================================
      // PRUEBA 2: ROLLBACK ANTE FALTA DE STOCK
      // ==================================================

      const failedOrder = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 2,
          status: 'READY_FOR_PICKUP',
          totalCents: 2000,
          items: {
            create: {
              productId,
              productNameSnapshot: product.name,
              unitPriceCentsSnapshot: 1000,
              quantity: 2,
              subtotalCents: 2000,
            },
          },
        },
      });

      const failedQr = await qrAdapter.issue({
        orderId: failedOrder.id,
        customerId,
        now,
      });

      const failedHash = createHash('sha256')
        .update(failedQr.token)
        .digest('hex');

      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            storeId,
            orderId: failedOrder.id,
            employeeUserId: 'employee-test',
            credential: {
              type: 'QR',
              token: failedQr.token,
            },
            now,
          }),
        /STOCK_RESERVATION_CONFLICT/
      );

      const unchangedOrder =
        await prisma.order.findUniqueOrThrow({
          where: { id: failedOrder.id },
        });

      assert.equal(
        unchangedOrder.status,
        'READY_FOR_PICKUP'
      );
      assert.equal(unchangedOrder.pickedUpAt, null);

      const unchangedQr =
        await prisma.pickupToken.findUniqueOrThrow({
          where: { tokenHash: failedHash },
        });

      assert.equal(unchangedQr.usedAt, null);

      assert.equal(
        await prisma.stockMovement.count({
          where: {
            referenceId: failedOrder.id,
            type: 'ORDER_FULFILLED',
          },
        }),
        0
      );

      // ==================================================
      // PRUEBA 3: EMISIÓN, BÚSQUEDA Y RETIRO MANUAL
      // ==================================================

      const manualOrder = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 3,
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

      // Un cliente ajeno no puede obtener el código.
      await assert.rejects(
        () =>
          manualAdapter.issue(
            manualOrder.id,
            randomUUID()
          ),
        /ORDER_NOT_AVAILABLE_FOR_PICKUP/
      );

      // El cliente dueño del pedido genera su código.
      const firstManual = await manualAdapter.issue(
        manualOrder.id,
        customerId
      );

      assert.equal(firstManual.code.length, 12);
      assert.equal(firstManual.orderId, manualOrder.id);

      // PostgreSQL almacena el hash, no el código.
      const orderWithCode =
        await prisma.order.findUniqueOrThrow({
          where: { id: manualOrder.id },
        });

      assert.equal(
        orderWithCode.pickupCode,
        hashManualPickupCode(firstManual.code)
      );

      assert.notEqual(
        orderWithCode.pickupCode,
        firstManual.code
      );

      // Reemitir reemplaza el código anterior.
      const secondManual = await manualAdapter.issue(
        manualOrder.id,
        customerId
      );

      assert.notEqual(
        secondManual.code,
        firstManual.code
      );

      // El código anterior no permite buscar el pedido.
      await assert.rejects(
        () =>
          manualAdapter.findByCode(
            storeId,
            firstManual.code
          ),
        /ORDER_NOT_FOUND/
      );

      // El código vigente permite encontrarlo.
      const foundOrder =
        await manualAdapter.findByCode(
          storeId,
          secondManual.code
        );

      assert.equal(foundOrder.orderId, manualOrder.id);
      assert.equal(foundOrder.storeId, storeId);
      assert.equal(
        foundOrder.status,
        'READY_FOR_PICKUP'
      );

      // No funciona en otro buffet.
      await assert.rejects(
        () =>
          manualAdapter.findByCode(
            randomUUID(),
            secondManual.code
          ),
        /ORDER_NOT_FOUND/
      );

      const manualInput = {
        storeId,
        orderId: manualOrder.id,
        employeeUserId: 'employee-test',
        credential: {
          type: 'MANUAL' as const,
          code: secondManual.code,
        },
        now,
      };

      // El código anterior no confirma el retiro.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...manualInput,
            credential: {
              type: 'MANUAL',
              code: firstManual.code,
            },
          }),
        /INVALID_PICKUP_CODE/
      );

      // Un código incorrecto tampoco confirma.
      await assert.rejects(
        () =>
          confirmAdapter.confirm({
            ...manualInput,
            credential: {
              type: 'MANUAL',
              code: 'CodigoFalso',
            },
          }),
        /INVALID_PICKUP_CODE/
      );

      // Confirmación exitosa por código manual.
      const manualResult =
        await confirmAdapter.confirm(manualInput);

      assert.equal(manualResult.status, 'COMPLETED');

      const completedManual =
        await prisma.order.findUniqueOrThrow({
          where: { id: manualOrder.id },
        });

      assert.equal(completedManual.status, 'COMPLETED');
      assert.equal(completedManual.pickupMethod, 'MANUAL');
      assert.equal(
        completedManual.pickedUpByUserId,
        'employee-test'
      );
      assert.deepEqual(completedManual.pickedUpAt, now);

      assert.equal(
        await prisma.stockMovement.count({
          where: {
            referenceId: manualOrder.id,
            type: 'ORDER_FULFILLED',
          },
        }),
        1
      );

      // No se puede entregar dos veces.
      const repeatedManualResult =
  await confirmAdapter.confirm(manualInput);

    assert.equal(repeatedManualResult.status, 'COMPLETED');
    assert.deepEqual(
    repeatedManualResult.pickedUpAt,
    completedManual.pickedUpAt
    );

      // El pedido completado ya no se busca por código.
      await assert.rejects(
        () =>
          manualAdapter.findByCode(
            storeId,
            secondManual.code
          ),
        /ORDER_NOT_FOUND/
      );

      const finalStock =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      assert.equal(finalStock.reservedStock, 0);
    } finally {
      // Limpiar únicamente los registros del test.
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
