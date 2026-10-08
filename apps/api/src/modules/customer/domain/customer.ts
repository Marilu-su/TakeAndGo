import { DomainError } from '../../../shared/domain/DomainError';

export type Customer = {
    id: string;
    name: string;
    email: string;
};

export type NewCustomer = Omit<Customer, 'id'>;

type CreateCustomerInput = {
    name: string;
    email: string;
};

export function createNewCustomer(input: CreateCustomerInput): NewCustomer {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (!name) {
        throw new DomainError(
            'INVALID_CUSTOMER_NAME',
            'El nombre del cliente es obligatorio',
        );
    }

    if (!email) {
        throw new DomainError(
            'INVALID_CUSTOMER_EMAIL',
            'El email del cliente es obligatorio',
        );
    }

    return {
        name,
        email,
    };
}