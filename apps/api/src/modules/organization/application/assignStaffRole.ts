import { DomainError } from '../../../shared/domain/DomainError';
import { createStaffScope, type StaffRole, type StaffScope } from '../domain/staffScope';
import type { OrganizationRepositoryPort, StaffScopeRepositoryPort, StoreRepositoryPort } from './ports';

export type AssignStaffRoleCommand = {
    authUserId: string;
    role: StaffRole;
    organizationId?: string;
    storeId?: string;
};

type Dependencies = {
    organizations: OrganizationRepositoryPort;
    stores: StoreRepositoryPort;
    staffScopes: StaffScopeRepositoryPort;
};

/**
 * Operación administrativa interna, usada por el script de asignación de roles.
 * No recibe Actor: la administración de staff desde la aplicación queda fuera del alcance del MVP.
 */
export function makeAssignStaffRole({ organizations, stores, staffScopes }: Dependencies) {
    return async function assignStaffRole(command: AssignStaffRoleCommand): Promise<StaffScope> {
        if (command.role === 'ORGANIZATION_ADMIN') {
        if (!command.organizationId) {
            throw new DomainError('INVALID_STAFF_SCOPE', 'Falta indicar la organización');
        }

        const organization = await organizations.findById(command.organizationId);

        if (!organization) {
            throw new DomainError('ORGANIZATION_NOT_FOUND', 'La organización no existe');
        }

        return staffScopes.save(
            createStaffScope({
            authUserId: command.authUserId,
            role: command.role,
            organizationId: organization.id,
            storeId: null,
            }),
        );
        }

        if (!command.storeId) {
        throw new DomainError('INVALID_STAFF_SCOPE', 'Falta indicar el buffet');
        }

        const store = await stores.findById(command.storeId);

        if (!store) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        return staffScopes.save(
        createStaffScope({
            authUserId: command.authUserId,
            role: command.role,
            organizationId: store.organizationId,
            storeId: store.id,
        }),
        );
    };
}