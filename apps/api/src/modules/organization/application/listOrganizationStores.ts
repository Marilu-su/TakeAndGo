import type { Actor } from '../../../shared/auth/actor';
import type { Store } from '../domain/store';
import { assertCanManageOrganization } from '../domain/organizationAuthorization';
export interface OrganizationStoreListingPort { listByOrganization(organizationId: string): Promise<Store[]> }
export function makeListOrganizationStores(stores: OrganizationStoreListingPort) {
  return async (actor: Actor, organizationId: string) => {
    assertCanManageOrganization(actor, organizationId);
    return stores.listByOrganization(organizationId);
  };
}
