import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { createNewAddition, type Addition } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { AdditionRepositoryPort, StoreScopePort } from './ports';

export type CreateAdditionCommand = {
    storeId: string;
    name: string;
    priceCents: number;
};

type Dependencies = {
    additions: AdditionRepositoryPort;
    stores: StoreScopePort;
};

export function makeCreateAddition({ additions, stores }: Dependencies) {
    return async function createAddition(actor: Actor, command: CreateAdditionCommand): Promise<Addition> {
        assertCanManageStoreCatalog(actor, command.storeId);

        if (!(await stores.storeExists(command.storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        const newAddition = createNewAddition(command);

        return additions.create(newAddition);
    };
}