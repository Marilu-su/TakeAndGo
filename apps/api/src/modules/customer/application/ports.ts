import type { Customer, NewCustomer } from '../domain/customer';

export interface CustomerRepositoryPort {
    findById(id: string): Promise<Customer | null>;
    create(customer: NewCustomer): Promise<Customer>;
}
