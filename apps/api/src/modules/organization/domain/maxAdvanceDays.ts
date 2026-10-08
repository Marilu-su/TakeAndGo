import { DomainError } from '../../../shared/domain/DomainError';

export const DEFAULT_MAX_ADVANCE_DAYS = 7;

export function validateMaxAdvanceDays(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
        throw new DomainError(
        'INVALID_MAX_ADVANCE_DAYS',
        'La anticipación máxima debe ser un número entero de días mayor o igual a 1',
        );
    }

    return value;
}