import { DomainError } from '../../../../shared/domain/DomainError';

type Body = Record<string, unknown>;

function asBody(body: unknown): Body {
    return body !== null && typeof body === 'object' ? (body as Body) : {};
}

function invalid(message: string): DomainError {
    return new DomainError('INVALID_REQUEST', message);
}

export function requireString(body: unknown, field: string): string {
    const value = asBody(body)[field];

    if (typeof value !== 'string') {
        throw invalid(`El campo ${field} es obligatorio y debe ser texto`);
    }

    return value;
}

export function requireNumber(body: unknown, field: string): number {
    const value = asBody(body)[field];

    if (typeof value !== 'number') {
        throw invalid(`El campo ${field} es obligatorio y debe ser numérico`);
    }

    return value;
}

export function optionalString(body: unknown, field: string): string | undefined {
    const value = asBody(body)[field];

    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw invalid(`El campo ${field} debe ser texto`);
    }

    return value;
}

export function optionalNullableString(body: unknown, field: string): string | null | undefined {
    const value = asBody(body)[field];

    if (value === null) {
        return null;
    }

    return optionalString(body, field);
}

export function optionalNumber(body: unknown, field: string): number | undefined {
    const value = asBody(body)[field];

    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'number') {
        throw invalid(`El campo ${field} debe ser numérico`);
    }

    return value;
}

export function requireStringArray(body: unknown, field: string): string[] {
    const value = asBody(body)[field];

    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        throw invalid(`El campo ${field} es obligatorio y debe ser una lista de textos`);
    }

    return value;
}