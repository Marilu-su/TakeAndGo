export type OrderStatus =
  | 'RESERVED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface OrderItemAdditionSnapshot {
  id?: string;
  additionId?: string | null;
  additionNameSnapshot: string;
  unitPriceCentsSnapshot: number;
  quantity: number;
  subtotalCents: number;
}

export interface OrderItemSnapshot {
  id?: string;
  productId?: string | null;
  productNameSnapshot: string;
  unitPriceCentsSnapshot: number;
  quantity: number;
  subtotalCents: number;
  additions: OrderItemAdditionSnapshot[];
}

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  orderNumber: number;
  status: OrderStatus;
  totalCents: number;
  reservedUntil?: Date | null;
  pickupCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemSnapshot[];
}