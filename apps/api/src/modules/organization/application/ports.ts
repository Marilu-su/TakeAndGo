import type { Organization } from '../domain/organization';
import type { NewStore, Store, StoreStatus } from '../domain/store';
import type { StoreCode } from '../domain/storeCode';
import type { NewStaffScope, StaffScope } from '../domain/staffScope';
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

export interface StaffScopeRepositoryPort {
    findByAuthUserId(authUserId: string): Promise<StaffScope | null>;

    /**
     * Guarda el rol de staff del usuario.
     * Si ya tenía uno, lo reemplaza: cada usuario tiene como máximo un rol de staff.
     */
    save(scope: NewStaffScope): Promise<StaffScope>;
}