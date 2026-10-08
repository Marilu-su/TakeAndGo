import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';

export function assertCanManageOrganization(actor: Actor, organizationId: string): void {
    const isAdminOfOrganization =
        actor.role === 'ORGANIZATION_ADMIN' && actor.organizationId === organizationId;

    if (!isAdminOfOrganization) {
        throw new DomainError('FORBIDDEN', 'No tiene permisos para administrar esta organización');
    }
}