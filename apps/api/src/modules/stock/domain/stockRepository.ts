import { AdditionStock, ProductStock } from './stock';

export interface ReserveStockItemInput {
  productId?: string | null;
  additionIds?: string[];
  quantity: number;
}

export interface StockRepository {
  getProductStock(storeId: string, productId: string): Promise<ProductStock | null>;
  getAdditionStock(storeId: string, additionId: string): Promise<AdditionStock | null>;
  
  // Verifica si hay existencias suficientes para una lista de ítems
  hasSufficientStock(storeId: string, items: ReserveStockItemInput[]): Promise<boolean>;

  // Reserva stock pasando de availableStock a reservedStock (para C2-14)
  reserveStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void>;

  // Libera reservas si la orden expira o se cancela
  releaseStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void>;

  // Descuenta definitivamente el stock reservado al completarse el pedido
  fulfillStock(storeId: string, orderId: string, items: ReserveStockItemInput[]): Promise<void>;

  // Ajuste manual de stock por el buffet
  setProductStock(storeId: string, productId: string, availableQuantity: number): Promise<ProductStock>;
  setAdditionStock(storeId: string, additionId: string, availableQuantity: number): Promise<AdditionStock>;
}