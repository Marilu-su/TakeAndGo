import { DomainError } from '../../../shared/domain/DomainError';
import type { Customer } from '../domain/customer';
import type { CustomerRepositoryPort } from './ports';

type Dependencies = {
    customers: CustomerRepositoryPort;
};

export function makeGetCustomer({ customers }: Dependencies) {
    return async function getCustomer(customerId: string): Promise<Customer> {
        const customer = await customers.findById(customerId);

        if (!customer) {
            throw new DomainError('CUSTOMER_NOT_FOUND', 'El customer no existe');
        }

        return customer;
    };
}