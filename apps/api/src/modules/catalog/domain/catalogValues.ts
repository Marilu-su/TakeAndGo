import { DomainError } from '../../../shared/domain/DomainError';

export function validatePriceCents(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new DomainError(
        'INVALID_PRICE',
        'El precio debe expresarse en centavos como un número entero mayor o igual a 0',
        );
    }

    return value;
}

export function validatePreparationSeconds(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new DomainError(
        'INVALID_PREPARATION_TIME',
        'El tiempo de preparación debe expresarse en segundos como un número entero mayor o igual a 0',
        );
    }

    return value;
}

export function requireName(value: string, errorCode: string, message: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new DomainError(errorCode, message);
    }

    return normalized;
}

export function normalizeDescription(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? '';

    return normalized ? normalized : null;
}