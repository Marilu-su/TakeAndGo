import type { Organization } from '../domain/organization';
import type { NewStore, Store, StoreStatus } from '../domain/store';
import type { StoreCode } from '../domain/storeCode';
export interface OrganizationRepositoryPort {
    findById(id: string): Promise<Organization | null>;
    updateMaxAdvanceDays(id: string, maxAdvanceDays: number): Promise<Organization>;
}

export interface StoreRepositoryPort {
    findById(id: string): Promise<Store | null>;
    findByCode(code: StoreCode): Promise<Store | null>;
    /**
     * Persiste un buffet nuevo.
     * Lanza DomainError('STORE_CODE_ALREADY_EXISTS') si el código ya existe.
     */
    create(store: NewStore): Promise<Store>;

    updateStatus(id: string, status: StoreStatus): Promise<Store>;
}