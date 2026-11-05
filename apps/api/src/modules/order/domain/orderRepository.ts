
import { Order } from './order';

export interface CreateOrderItemInput {
  productId?: string | null;
  productNameSnapshot: string;
  unitPriceCentsSnapshot: number;
  quantity: number;
  subtotalCents: number;
  additions?: {
    additionId?: string | null;
    additionNameSnapshot: string;
    unitPriceCentsSnapshot: number;
    quantity: number;
    subtotalCents: number;
  }[];
}

export interface CreateOrderInput {
  storeId: string;
  customerId: string;
  status?: Order['status'];
  totalCents: number;
  reservedUntil?: Date | null;

  // Ventana prometida de retiro
  scheduledForDate?: Date | null;
  promisedFrom?: Date | null;
  promisedTo?: Date | null;
  toleranceUntil?: Date | null;

  items: CreateOrderItemInput[];
}

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByStoreAndNumber(
    storeId: string,
    orderNumber: number
  ): Promise<Order | null>;
  findActiveByCustomer(customerId: string): Promise<Order[]>;

  updateStatus(
    id: string,
    status: Order['status']
  ): Promise<Order>;

  findExpiredReservations(now: Date): Promise<Order[]>;

  updateStatusIfCurrent(
    id: string,
    currentStatus: Order['status'],
    nextStatus: Order['status']
  ): Promise<Order | null>;

  finishPreparationIfCurrent(
    id: string,
    preparedAt: Date,
    preparedByUserId: string
  ): Promise<Order | null>;

  activatePickupIfEligible(
    id: string,
    expectedPromisedFrom: Date,
    expectedPromisedTo: Date,
    now: Date
  ): Promise<Order | null>;

  findPreparedOrdersInPickupWindow(now: Date): Promise<Order[]>;
}
