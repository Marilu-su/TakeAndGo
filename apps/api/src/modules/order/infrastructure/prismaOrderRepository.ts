import { getPrisma } from '../../../infrastructure/database/prisma';
import { Order, OrderStatus } from '../domain/order';
import { CreateOrderInput, OrderRepository } from '../domain/orderRepository';

export class PrismaOrderRepository implements OrderRepository {
  async create(input: CreateOrderInput): Promise<Order> {
    const prisma = getPrisma();

    // Calcular el siguiente orderNumber para este buffet/store de forma incremental
    const lastOrder = await prisma.order.findFirst({
      where: { storeId: input.storeId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    const created = await prisma.order.create({
      data: {
        storeId: input.storeId,
        customerId: input.customerId,
        orderNumber: nextOrderNumber,
        status: input.status ?? 'RESERVED',
        totalCents: input.totalCents,
        reservedUntil: input.reservedUntil,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            unitPriceCentsSnapshot: item.unitPriceCentsSnapshot,
            quantity: item.quantity,
            subtotalCents: item.subtotalCents,
            additions: item.additions && item.additions.length > 0
              ? {
                  create: item.additions.map((add) => ({
                    additionId: add.additionId,
                    additionNameSnapshot: add.additionNameSnapshot,
                    unitPriceCentsSnapshot: add.unitPriceCentsSnapshot,
                    quantity: add.quantity,
                    subtotalCents: add.subtotalCents,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
    });

    return this.mapToDomain(created);
  }

  async findById(id: string): Promise<Order | null> {
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
    });

    return order ? this.mapToDomain(order) : null;
  }

  async findByStoreAndNumber(storeId: string, orderNumber: number): Promise<Order | null> {
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: {
        storeId_orderNumber: {
          storeId,
          orderNumber,
        },
      },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
    });

    return order ? this.mapToDomain(order) : null;
  }

  async findActiveByCustomer(customerId: string): Promise<Order[]> {
    const prisma = getPrisma();
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: {
          notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED'],
        },
      },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.mapToDomain(o));
  }

  async findExpiredReservations(now: Date): Promise<Order[]> {
    const prisma = getPrisma();
    const orders = await prisma.order.findMany({
      where: {
        status: 'RESERVED',
        reservedUntil: {
          lt: now,
        },
      },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
      orderBy: { reservedUntil: 'asc' },
    });

    return orders.map((o) => this.mapToDomain(o));
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const prisma = getPrisma();
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            additions: true,
          },
        },
      },
    });

    return this.mapToDomain(updated);
  }

  private mapToDomain(raw: any): Order {
    return {
      id: raw.id,
      storeId: raw.storeId,
      customerId: raw.customerId,
      orderNumber: raw.orderNumber,
      status: raw.status as OrderStatus,
      totalCents: raw.totalCents,
      reservedUntil: raw.reservedUntil,
      pickupCode: raw.pickupCode,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      items: (raw.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        unitPriceCentsSnapshot: item.unitPriceCentsSnapshot,
        quantity: item.quantity,
        subtotalCents: item.subtotalCents,
        additions: (item.additions || []).map((add: any) => ({
          id: add.id,
          additionId: add.additionId,
          additionNameSnapshot: add.additionNameSnapshot,
          unitPriceCentsSnapshot: add.unitPriceCentsSnapshot,
          quantity: add.quantity,
          subtotalCents: add.subtotalCents,
        })),
      })),
    };
  }
}