import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { deactivateAddition as deactivate, type Addition } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { AdditionRepositoryPort } from './ports';

export type DeactivateAdditionCommand = {
    storeId: string;
    additionId: string;
};

type Dependencies = {
    additions: AdditionRepositoryPort;
};

export function makeDeactivateAddition({ additions }: Dependencies) {
    return async function deactivateAddition(actor: Actor, command: DeactivateAdditionCommand): Promise<Addition> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const addition = await additions.findById(command.additionId);

        if (!addition || addition.storeId !== command.storeId) {
        throw new DomainError('ADDITION_NOT_FOUND', 'El adicional no existe en este buffet');
        }

        const deactivated = deactivate(addition);

        if (deactivated.isActive === addition.isActive) {
        return addition;
        }

        return additions.update(deactivated);
    };
}