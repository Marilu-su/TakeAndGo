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
  items: CreateOrderItemInput[];
}

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByStoreAndNumber(storeId: string, orderNumber: number): Promise<Order | null>;
  findActiveByCustomer(customerId: string): Promise<Order[]>;
  updateStatus(id: string, status: Order['status']): Promise<Order>;
}