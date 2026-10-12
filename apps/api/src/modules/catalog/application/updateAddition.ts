import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { updateAddition as applyChanges, type Addition, type AdditionChanges } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { AdditionRepositoryPort } from './ports';

export type UpdateAdditionCommand = {
    storeId: string;
    additionId: string;
    changes: AdditionChanges;
};

type Dependencies = {
    additions: AdditionRepositoryPort;
};

export function makeUpdateAddition({ additions }: Dependencies) {
    return async function updateAddition(actor: Actor, command: UpdateAdditionCommand): Promise<Addition> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const addition = await additions.findById(command.additionId);

        if (!addition || addition.storeId !== command.storeId) {
        throw new DomainError('ADDITION_NOT_FOUND', 'El adicional no existe en este buffet');
        }

        const updated = applyChanges(addition, command.changes);

        return additions.update(updated);
    };
}