export type StockMovementType =
  | 'INVENTORY_ADJUSTMENT'
  | 'ORDER_RESERVED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FULFILLED'
  | 'RESTOCK'
  | 'WEEKLY_REVIEW';

export interface ProductStock {
  id: string;
  storeId: string;
  productId: string;
  availableStock: number;
  reservedStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdditionStock {
  id: string;
  storeId: string;
  additionId: string;
  availableStock: number;
  reservedStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCheckItem {
  productId?: string | null;
  additionIds?: string[];
  quantity: number;
}

export interface StockMovementRecord {
  id: string;
  productId: string | null;
  additionId: string | null;
  quantity: number;
  type: StockMovementType;
  reason: string | null;
  actorUserId: string | null;
  referenceId: string | null;
  createdAt: Date;
}