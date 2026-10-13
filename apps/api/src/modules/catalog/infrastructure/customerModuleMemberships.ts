import { DomainError } from '../../../shared/domain/DomainError';
import type { ListCustomerStores } from '../../customer/infrastructure/customerModule';
import type { CustomerMembershipPort } from '../application/ports';

export class CustomerModuleMemberships implements CustomerMembershipPort {
    private readonly listCustomerStores: ListCustomerStores;

    constructor(listCustomerStores: ListCustomerStores) {
        this.listCustomerStores = listCustomerStores;
    }

    async isCustomerAssociatedToStore(customerId: string, storeId: string): Promise<boolean> {
        try {
        const stores = await this.listCustomerStores(customerId);

        return stores.some((store) => store.id === storeId);
        } catch (error) {
        if (error instanceof DomainError && error.code === 'CUSTOMER_NOT_FOUND') {
            return false;
        }

        throw error;
        }
    }
}