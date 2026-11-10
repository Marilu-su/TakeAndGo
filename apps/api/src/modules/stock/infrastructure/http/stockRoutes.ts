import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import type { ProductUseCases, AdditionUseCases } from '../../../catalog/infrastructure/catalogModule';
import type { StockRepository } from '../../domain/stockRepository';
import { assertCanManageStoreCatalog } from '../../../catalog/domain/catalogAuthorization';
import { DomainError } from '../../../../shared/domain/DomainError';
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
  router.put('/stores/:storeId/stock', async (req, res) => {
    const actor = await requireActor(deps.resolveActor, req);
    const storeId = req.params.storeId;
    assertCanManageStoreCatalog(actor, storeId);
    const { productId, additionId, availableStock, reason } = req.body ?? {};
    if ((typeof productId === 'string') === (typeof additionId === 'string') || !Number.isSafeInteger(availableStock) || availableStock < 0 || availableStock > 2147483647 || typeof reason !== 'string' || !reason.trim()) {
      throw new DomainError('INVALID_REQUEST', 'Indicá un producto o adicional, stock no negativo y motivo del ajuste.');
    }
    if (productId) {
      const products = await deps.products(actor, storeId);
      if (!products.some(product => product.id === productId)) throw new DomainError('NOT_FOUND', 'Producto no encontrado en este buffet.');
      res.json(await deps.stock.setProductStock(storeId, productId, availableStock, reason.trim(), actor.userId));
    } else {
      const additions = await deps.additions(actor, storeId);
      if (!additions.some(addition => addition.id === additionId)) throw new DomainError('NOT_FOUND', 'Adicional no encontrado en este buffet.');
      res.json(await deps.stock.setAdditionStock(storeId, additionId, availableStock, reason.trim(), actor.userId));
    }
  });
  return router;
}
