import { DomainError } from '../../../shared/domain/DomainError';
import { requireName, validatePriceCents } from './catalogValues';

export type Addition = {
    id: string;
    storeId: string;
    name: string;
    priceCents: number;
    isActive: boolean;
};

export type NewAddition = Omit<Addition, 'id'>;

export type AdditionChanges = Partial<Pick<Addition, 'name' | 'priceCents'>>;

const INVALID_NAME_CODE = 'INVALID_ADDITION_NAME';
const INVALID_NAME_MESSAGE = 'El nombre del adicional es obligatorio';

export function createNewAddition(input: { storeId: string; name: string; priceCents: number }): NewAddition {
    return {
        storeId: input.storeId,
        name: requireName(input.name, INVALID_NAME_CODE, INVALID_NAME_MESSAGE),
        priceCents: validatePriceCents(input.priceCents),
        isActive: true,
    };
}

export function updateAddition(addition: Addition, changes: AdditionChanges): Addition {
    return {
        ...addition,
        name:
        changes.name === undefined
            ? addition.name
            : requireName(changes.name, INVALID_NAME_CODE, INVALID_NAME_MESSAGE),
        priceCents:
        changes.priceCents === undefined ? addition.priceCents : validatePriceCents(changes.priceCents),
    };
}

export function deactivateAddition(addition: Addition): Addition {
    return {
        ...addition,
        isActive: false,
    };
}

export function assertAdditionsBelongToStore(additions: Addition[], storeId: string): void {
    const foreignAddition = additions.find((addition) => addition.storeId !== storeId);

    if (foreignAddition) {
        throw new DomainError('INVALID_ADDITION_SCOPE', 'Uno de los adicionales no pertenece a este buffet');
    }
}