import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { ProductUseCases, AdditionUseCases } from '../../../catalog/infrastructure/catalogModule';
import type { StockRepository } from '../../domain/stockRepository';
import { assertCanManageStoreCatalog } from '../../../catalog/domain/catalogAuthorization';
export function createStockRouter(deps: {
  resolveActor: ActorResolver;
  products: ProductUseCases['listProducts'];
  additions: AdditionUseCases['listAdditions'];
  stock: StockRepository;
}) {
  const router = Router();
  router.get('/stores/:storeId/stock', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    const storeId = req.params.storeId;
    assertCanManageStoreCatalog(actor, storeId);
    // Catalog use cases enforce STORE_ADMIN and buffet scope before reading stock.
    const [products, additions] = await Promise.all([deps.products(actor, storeId), deps.additions(actor, storeId)]);
    res.json({
      products: await Promise.all(products.map(async p => ({ id: p.id, name: p.name, stock: await deps.stock.getProductStock(storeId, p.id) }))),
      additions: await Promise.all(additions.map(async a => ({ id: a.id, name: a.name, stock: await deps.stock.getAdditionStock(storeId, a.id) }))),
    });
  });
  return router;
}
