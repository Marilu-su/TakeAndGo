import type { CatalogAvailability, CatalogAvailabilityPort } from '../application/ports';

/**
 * Implementación provisoria hasta que exista el módulo de stock (C2-13):
 * considera disponibles todos los productos y adicionales.
 * Al implementarse el stock, se reemplaza por un adaptador que consulte la disponibilidad real.
 */
export class AllAvailableCatalogAvailability implements CatalogAvailabilityPort {
    async getAvailability(_storeId: string, productIds: string[], additionIds: string[]): Promise<CatalogAvailability> {
        return {
        availableProductIds: new Set(productIds),
        availableAdditionIds: new Set(additionIds),
        };
    }
}