import type { StaffScope } from '../../modules/organization/domain/staffScope';
import type { Actor } from '../../shared/auth/actor';
import type { ActorResolver } from '../../shared/http/actorResolver';
import type { IdentityResolver } from '../../shared/http/identityResolver';

type Dependencies = {
    resolveIdentity: IdentityResolver;
    findStaffScope: (authUserId: string) => Promise<StaffScope | null>;
    findCustomer: (authUserId: string) => Promise<{ id: string } | null>;
};

export function createActorResolver({ resolveIdentity, findStaffScope, findCustomer }: Dependencies): ActorResolver {
    return async (req) => {
        const identity = await resolveIdentity(req);

        if (!identity) {
        return null;
        }

        const staff = await findStaffScope(identity.authUserId);

        if (staff) {
        const actor: Actor = {
            userId: identity.authUserId,
            role: staff.role,
            organizationId: staff.organizationId,
        };

        if (staff.storeId) {
            actor.storeId = staff.storeId;
        }

        return actor;
        }

        const customer = await findCustomer(identity.authUserId);

        if (customer) {
        // Para un CUSTOMER, el userId del Actor es el id de su Customer (supuesto acordado en C2-10).
        return { userId: customer.id, role: 'CUSTOMER' };
        }

        return null;
    };
}