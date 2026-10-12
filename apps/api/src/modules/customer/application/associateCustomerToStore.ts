import { DomainError } from '../../../shared/domain/DomainError';
import type { StoreRepositoryPort } from '../../organization/application/ports';
import { createStoreCode } from '../../organization/domain/storeCode';
import type { CustomerStoreMembership } from '../domain/customerStoreMembership';
import type {
    CustomerRepositoryPort,
    CustomerStoreMembershipRepositoryPort,
} from './ports';

export type AssociateCustomerToStoreCommand = {
    customerId: string;
    storeCode: string;
};

type Dependencies = {
    customers: CustomerRepositoryPort;
    stores: StoreRepositoryPort;
    memberships: CustomerStoreMembershipRepositoryPort;
};

export function makeAssociateCustomerToStore({
    customers,
    stores,
    memberships,
}: Dependencies) {
    return async function associateCustomerToStore(
        command: AssociateCustomerToStoreCommand,
    ): Promise<CustomerStoreMembership> {
        const code = createStoreCode(command.storeCode);

        const customer = await customers.findById(command.customerId);

        if (!customer) {
            throw new DomainError(
                'CUSTOMER_NOT_FOUND',
                'El customer no existe',
            );
        }

        const store = await stores.findByCode(code);

        if (!store) {
            throw new DomainError(
                'STORE_NOT_FOUND',
                'El buffet no existe',
            );
        }

        return memberships.create({
            customerId: customer.id,
            storeId: store.id,
        });
    };
}
