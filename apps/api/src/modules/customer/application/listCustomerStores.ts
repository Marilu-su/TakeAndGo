import { DomainError } from '../../../shared/domain/DomainError';
import type { Store } from '../../organization/domain/store';
import type { StoreRepositoryPort } from '../../organization/application/ports';
import type {
    CustomerRepositoryPort,
    CustomerStoreMembershipRepositoryPort,
} from './ports';

type Dependencies = {
    customers: CustomerRepositoryPort;
    stores: StoreRepositoryPort;
    memberships: CustomerStoreMembershipRepositoryPort;
};

export function makeListCustomerStores({
    customers,
    stores,
    memberships,
}: Dependencies) {
    return async function listCustomerStores(
        customerId: string,
    ): Promise<Store[]> {
        const customer = await customers.findById(customerId);

        if (!customer) {
            throw new DomainError(
                'CUSTOMER_NOT_FOUND',
                'El customer no existe',
            );
        }

        const customerMemberships =
            await memberships.findByCustomerId(customerId);

        const associatedStores = await Promise.all(
            customerMemberships.map((membership) =>
                stores.findById(membership.storeId),
            ),
        );

        return associatedStores.filter(
            (store): store is Store => store !== null,
        );
    };
}