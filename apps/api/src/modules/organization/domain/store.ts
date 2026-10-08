import { DomainError } from '../../../shared/domain/DomainError';
import { createStoreCode, type StoreCode } from './storeCode';

export type StoreStatus = 'PENDING_SETUP' | 'ACTIVE' | 'INACTIVE';

export type Store = {
    id: string;
    organizationId: string;
    name: string;
    code: StoreCode;
    status: StoreStatus;
};

export type NewStore = Omit<Store, 'id'>;

type CreateStoreInput = {
    organizationId: string;
    name: string;
    code: string;
};

export function createNewStore(input: CreateStoreInput): NewStore {
    const name = input.name.trim();

    if (!name) {
        throw new DomainError('INVALID_STORE_NAME', 'El nombre del buffet es obligatorio');
    }

    return {
        organizationId: input.organizationId,
        name,
        code: createStoreCode(input.code),
        status: 'PENDING_SETUP',
    };
}

export function deactivateStore(store: Store): Store {
    return {
        ...store,
        status: 'INACTIVE',
    };
}