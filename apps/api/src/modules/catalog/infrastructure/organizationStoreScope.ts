import { DomainError } from '../../../shared/domain/DomainError';
import type { GetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import type { StoreScopePort } from '../application/ports';

export class OrganizationStoreScope implements StoreScopePort {
    private readonly getStoreConfiguration: GetStoreConfiguration;

    constructor(getStoreConfiguration: GetStoreConfiguration) {
        this.getStoreConfiguration = getStoreConfiguration;
    }

    async storeExists(storeId: string): Promise<boolean> {
        try {
        await this.getStoreConfiguration(storeId);
        return true;
        } catch (error) {
        if (error instanceof DomainError && error.code === 'STORE_NOT_FOUND') {
            return false;
        }

        throw error;
        }
    }
}