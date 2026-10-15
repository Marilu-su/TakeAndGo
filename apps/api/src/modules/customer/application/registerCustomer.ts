import type { AuthenticatedIdentity } from '../../../shared/auth/tokenVerifier';
import { DomainError } from '../../../shared/domain/DomainError';
import { createNewCustomer, type Customer } from '../domain/customer';
import type { CustomerRepositoryPort } from './ports';

export type RegisterCustomerCommand = {
    name: string;
};

type Dependencies = {
    customers: CustomerRepositoryPort;
};

/**
 * Registra como cliente a un usuario ya autenticado en Neon Auth.
 * El email se toma del token, no de lo que envía el usuario.
 */
export function makeRegisterCustomer({ customers }: Dependencies) {
    return async function registerCustomer(
        identity: AuthenticatedIdentity,
        command: RegisterCustomerCommand,
    ): Promise<Customer> {
        if (!identity.email) {
            throw new DomainError(
                'INVALID_CUSTOMER_EMAIL',
                'La cuenta no tiene un email asociado',
            );
        }

        const existing = await customers.findByAuthUserId(identity.authUserId);

        if (existing) {
            throw new DomainError(
                'CUSTOMER_ALREADY_REGISTERED',
                'El usuario ya está registrado como cliente',
            );
        }

        const newCustomer = createNewCustomer({
            name: command.name,
            email: identity.email,
            authUserId: identity.authUserId,
        });

        return customers.create(newCustomer);
    };
}