import type { Customer, NewCustomer } from '../domain/customer';
import type {
    CustomerStoreMembership,
    NewCustomerStoreMembership,
} from '../domain/customerStoreMembership';
export interface CustomerRepositoryPort {
    findById(id: string): Promise<Customer | null>;
    create(customer: NewCustomer): Promise<Customer>;
    findByAuthUserId(authUserId: string): Promise<Customer | null>;
}
export interface CustomerStoreMembershipRepositoryPort {
    create(
        membership: NewCustomerStoreMembership,
    ): Promise<CustomerStoreMembership>;

    findByCustomerId(
        customerId: string,
    ): Promise<CustomerStoreMembership[]>;
}
