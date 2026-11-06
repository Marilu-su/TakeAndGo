import type { CatalogAvailabilityPort } from '../application/ports';
import type { StockRepository } from '../../stock/domain/stockRepository';
export class StockCatalogAvailability implements CatalogAvailabilityPort {
  constructor(private readonly stock: Pick<StockRepository, 'getProductStock' | 'getAdditionStock'>) {}
  async getAvailability(storeId: string, productIds: string[], additionIds: string[]) {
    const [products, additions] = await Promise.all([
      Promise.all(productIds.map(async id => ({ id, stock: await this.stock.getProductStock(storeId, id) }))),
      Promise.all(additionIds.map(async id => ({ id, stock: await this.stock.getAdditionStock(storeId, id) }))),
    ]);
    // Missing stock records retain the stock module's existing unrestricted behavior.
    return {
      availableProductIds: new Set(products.filter(p => !p.stock || p.stock.availableStock > 0).map(p => p.id)),
      availableAdditionIds: new Set(additions.filter(a => !a.stock || a.stock.availableStock > 0).map(a => a.id)),
    };
  }
}
