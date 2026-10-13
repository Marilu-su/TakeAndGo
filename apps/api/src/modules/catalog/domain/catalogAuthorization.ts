import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';

export function assertCanManageStoreCatalog(actor: Actor, storeId: string): void {
    const isAdminOfStore = actor.role === 'STORE_ADMIN' && actor.storeId === storeId;

    if (!isAdminOfStore) {
        throw new DomainError('FORBIDDEN', 'No tiene permisos para administrar el catálogo de este buffet');
    }
}

export function isStoreStaff(actor: Actor, storeId: string): boolean {
    const isStaffRole = actor.role === 'STORE_ADMIN' || actor.role === 'STORE_EMPLOYEE';

    return isStaffRole && actor.storeId === storeId;
}