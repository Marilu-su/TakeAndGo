import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { IdentityResolver } from '../../../../shared/http/identityResolver';
import { requireIdentity } from '../../../../shared/http/requireIdentity';
import type { RegisterCustomer } from '../customerModule';

type Dependencies = {
    registerCustomer: RegisterCustomer;
    resolveIdentity: IdentityResolver;
};

export function createCustomerRouter({ registerCustomer, resolveIdentity }: Dependencies) {
    const router = Router();

    router.post('/me/customer', async (req, res) => {
        const identity = await requireIdentity(resolveIdentity, req);
        const name = (req.body as { name?: unknown } | undefined)?.name;

        if (typeof name !== 'string') {
            throw new DomainError('INVALID_REQUEST', 'El campo name es obligatorio y debe ser texto');
        }

        const customer = await registerCustomer(identity, { name });

        res.status(201).json({
            id: customer.id,
            name: customer.name,
            email: customer.email,
        });
    });

    return router;
}