import { createNewCustomer, type Customer } from '../domain/customer';
import type { CustomerRepositoryPort } from './ports';

export type CreateCustomerCommand = {
    name: string;
    email: string;
};

type Dependencies = {
    customers: CustomerRepositoryPort;
};

export function makeCreateCustomer({ customers }: Dependencies) {
    return async function createCustomer(command: CreateCustomerCommand): Promise<Customer> {
        const newCustomer = createNewCustomer(command);

        return customers.create(newCustomer);
    };
}
