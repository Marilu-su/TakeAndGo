import { DomainError } from '../../../shared/domain/DomainError';

const STORE_CODE_PATTERN = /^[A-Z]{3}[0-9]{3}$/;

export type StoreCode = string & { readonly __brand: 'StoreCode' };

export function createStoreCode(value: string): StoreCode {
    const normalized = value.trim().toUpperCase();

    if (!STORE_CODE_PATTERN.test(normalized)) {
        throw new DomainError(
        'INVALID_STORE_CODE',
        'El código del buffet debe tener 3 letras seguidas de 3 números (por ejemplo, ABC123)',
        );
    }

    return normalized as StoreCode;
}