import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { isStoreStaff } from '../domain/catalogAuthorization';
import type { StoreCatalog } from '../domain/storeCatalog';
import type { CustomerMembershipPort } from './ports';

type Dependencies = {
    getStoreCatalog: (storeId: string) => Promise<StoreCatalog>;
    memberships: CustomerMembershipPort;
};

export function makeRequireStoreCatalogAccess(memberships: CustomerMembershipPort) {
    async function canView(actor: Actor, storeId: string): Promise<boolean> {
        if (isStoreStaff(actor, storeId)) {
        return true;
        }

        if (actor.role === 'CUSTOMER') {
        // Hasta que exista la autenticación, el userId de un CUSTOMER es el id de su Customer.
        return memberships.isCustomerAssociatedToStore(actor.userId, storeId);
        }

        return false;
    }

    return async function requireStoreCatalogAccess(actor: Actor, storeId: string): Promise<void> {
        if (!(await canView(actor, storeId))) {
        throw new DomainError('FORBIDDEN', 'No tiene acceso al catálogo de este buffet');
        }
    };
}

export function makeViewStoreCatalog({ getStoreCatalog, memberships }: Dependencies) {
    const requireStoreCatalogAccess = makeRequireStoreCatalogAccess(memberships);

    return async function viewStoreCatalog(actor: Actor, storeId: string): Promise<StoreCatalog> {
        await requireStoreCatalogAccess(actor, storeId);
        return getStoreCatalog(storeId);
    };
}
