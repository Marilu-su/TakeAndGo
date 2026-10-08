import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { validateMaxAdvanceDays } from '../domain/maxAdvanceDays';
import type { Organization } from '../domain/organization';
import { assertCanManageOrganization } from '../domain/organizationAuthorization';
import type { OrganizationRepositoryPort } from './ports';

type Dependencies = {
    organizations: OrganizationRepositoryPort;
};

export function makeSetOrganizationMaxAdvanceDays({ organizations }: Dependencies) {
    return async function setOrganizationMaxAdvanceDays(
        actor: Actor,
        organizationId: string,
        maxAdvanceDays: number,
    ): Promise<Organization> {
        assertCanManageOrganization(actor, organizationId);

        const value = validateMaxAdvanceDays(maxAdvanceDays);

        const organization = await organizations.findById(organizationId);

        if (!organization) {
        throw new DomainError('ORGANIZATION_NOT_FOUND', 'La organización no existe');
        }

        return organizations.updateMaxAdvanceDays(organizationId, value);
    };
}