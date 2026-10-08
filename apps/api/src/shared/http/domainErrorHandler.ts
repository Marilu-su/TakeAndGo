import type { ErrorRequestHandler } from 'express';

import { DomainError } from '../domain/DomainError';

const HTTP_STATUS_BY_CODE: Record<string, number> = {
    INVALID_REQUEST: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    ORGANIZATION_NOT_FOUND: 404,
    STORE_NOT_FOUND: 404,
    STORE_CODE_ALREADY_EXISTS: 409,
    INVALID_STORE_CODE: 422,
    INVALID_STORE_NAME: 422,
    INVALID_MAX_ADVANCE_DAYS: 422,
};

export const domainErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (!(error instanceof DomainError)) {
        next(error);
        return;
    }

    const status = HTTP_STATUS_BY_CODE[error.code] ?? 400;

    res.status(status).json({
        error: error.message,
        code: error.code,
    });
};