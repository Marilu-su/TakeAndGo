import { DomainError } from '../../../shared/domain/DomainError';

export type StaffRole = 'ORGANIZATION_ADMIN' | 'STORE_ADMIN' | 'STORE_EMPLOYEE';

export const STAFF_ROLES: readonly StaffRole[] = ['ORGANIZATION_ADMIN', 'STORE_ADMIN', 'STORE_EMPLOYEE'];

export type StaffScope = {
    id: string;
    authUserId: string;
    role: StaffRole;
    organizationId: string;
    storeId: string | null;
};

export type NewStaffScope = Omit<StaffScope, 'id'>;

export function isStaffRole(value: string): value is StaffRole {
    return (STAFF_ROLES as readonly string[]).includes(value);
}

export function createStaffScope(input: NewStaffScope): NewStaffScope {
    const authUserId = input.authUserId.trim();

    if (!authUserId) {
        throw new DomainError('INVALID_STAFF_SCOPE', 'El usuario es obligatorio');
    }

    if (input.role === 'ORGANIZATION_ADMIN' && input.storeId !== null) {
        throw new DomainError('INVALID_STAFF_SCOPE', 'Un administrador de organización no se asigna a un buffet');
    }

    if (input.role !== 'ORGANIZATION_ADMIN' && input.storeId === null) {
        throw new DomainError('INVALID_STAFF_SCOPE', 'El personal de buffet debe estar asignado a un buffet');
    }

    return { ...input, authUserId };
}