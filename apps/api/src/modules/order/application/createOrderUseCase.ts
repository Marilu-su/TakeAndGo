import { OrderRepository } from '../domain/orderRepository';
import { StockRepository } from '../../stock/domain/stockRepository';
import { Order } from '../domain/order';
import { getPrisma } from '../../../infrastructure/database/prisma';

export interface CreateOrderItemRequest {
  productId: string;
  quantity: number;
  additionIds?: string[];
}

export interface CreateOrderRequest {
  storeId: string;
  customerId: string;
  items: CreateOrderItemRequest[];
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly stockRepository: StockRepository
  ) {}

  async execute(input: CreateOrderRequest): Promise<Order> {
    const prisma = getPrisma();

    // 1. Validar que la tienda exista
    const store = await prisma.store.findUnique({
      where: { id: input.storeId },
    });

    if (!store) {
      throw new Error('La tienda especificada no existe');
    }

    if (input.items.length === 0) {
      throw new Error('El pedido debe contener al menos un producto');
    }

    // 2. Verificar disponibilidad de stock para todos los ítems
    const stockItemsToCheck = input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      additionIds: i.additionIds,
    }));

    const hasStock = await this.stockRepository.hasSufficientStock(
      input.storeId,
      stockItemsToCheck
    );

    if (!hasStock) {
      throw new Error('Stock insuficiente para completar el pedido');
    }

    // 3. Obtener datos de catálogo para snapshots inmutables y cálculo de montos
    let totalCents = 0;
    const itemsData = [];

    for (const itemInput of input.items) {
      const product = await prisma.product.findUnique({
        where: { id: itemInput.productId },
      });

      if (!product || product.storeId !== input.storeId || !product.isActive) {
        throw new Error(`Producto inválido o no disponible: ${itemInput.productId}`);
      }

      let itemSubtotalCents = product.priceCents * itemInput.quantity;
      const additionsData = [];

      if (itemInput.additionIds && itemInput.additionIds.length > 0) {
        for (const additionId of itemInput.additionIds) {
          const addition = await prisma.addition.findUnique({
            where: { id: additionId },
          });

          if (!addition || addition.storeId !== input.storeId || !addition.isActive) {
            throw new Error(`Adicional inválido o no disponible: ${additionId}`);
          }

          const addSubtotalCents = addition.priceCents * itemInput.quantity;
          itemSubtotalCents += addSubtotalCents;

          additionsData.push({
            additionId: addition.id,
            additionNameSnapshot: addition.name,
            unitPriceCentsSnapshot: addition.priceCents,
            quantity: itemInput.quantity,
            subtotalCents: addSubtotalCents,
          });
        }
      }

      totalCents += itemSubtotalCents;

      itemsData.push({
        productId: product.id,
        productNameSnapshot: product.name,
        unitPriceCentsSnapshot: product.priceCents,
        quantity: itemInput.quantity,
        subtotalCents: itemSubtotalCents,
        additions: additionsData,
      });
    }

    // 4. Ventana de reserva de 15 minutos
    const reservedUntil = new Date(Date.now() + 15 * 60 * 1000);

    // 5. Crear la orden a través del repositorio
    const createdOrder = await this.orderRepository.create({
      storeId: input.storeId,
      customerId: input.customerId,
      status: 'RESERVED',
      totalCents,
      reservedUntil,
      items: itemsData,
    });

    // 6. Bloquear el stock transaccionalmente asociándolo a la orden
    await this.stockRepository.reserveStock(
      input.storeId,
      createdOrder.id,
      stockItemsToCheck
    );

    return createdOrder;
  }
}