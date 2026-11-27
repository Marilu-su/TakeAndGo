import { Router } from 'express';

import { DomainError } from '../../../../shared/domain/DomainError';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import type { IdentityResolver } from '../../../../shared/http/identityResolver';
import { requireIdentity } from '../../../../shared/http/requireIdentity';
import type { CreateStore } from '../organizationModule';
import { createPrismaOrganizationForOwner, createPrismaStaffAssignment } from '../organizationModule';

type Dependencies = {
    createStore: CreateStore;
    resolveActor: ActorResolver;
    resolveIdentity: IdentityResolver;
};

export function createOrganizationRouter({ createStore, resolveActor, resolveIdentity }: Dependencies) {
    const router = Router();

    router.post('/organizations', async (req, res) => {
        const identity = await requireIdentity(resolveIdentity, req);
        const name = req.body?.name;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
            throw new DomainError('INVALID_REQUEST', 'Indicá el nombre de la organización (hasta 120 caracteres).');
        }
        try {
            const organization = await createPrismaOrganizationForOwner(identity, name);
            res.status(201).json({ id: organization.id, name: organization.name, role: 'ORGANIZATION_ADMIN' });
        } catch (error) {
            if (error instanceof Error && error.message.includes('ya tiene un rol')) {
                throw new DomainError('ORGANIZATION_ALREADY_ASSIGNED', 'Esta cuenta ya tiene un rol administrativo.');
            }
            if (error instanceof Error && error.message.includes('nombre de la organización')) throw new DomainError('INVALID_REQUEST', error.message);
            throw error;
        }
    });

    router.post('/organizations/:organizationId/staff', async (req, res) => {
        const actor = await resolveActor(req);
        if (!actor) throw new DomainError('UNAUTHENTICATED', 'Se requiere autenticación');
        const { email, role, storeId } = req.body ?? {};
        if (typeof email !== 'string' || typeof storeId !== 'string' || !['STORE_ADMIN', 'STORE_EMPLOYEE'].includes(role)) {
            throw new DomainError('INVALID_REQUEST', 'Indicá email, rol y buffet válidos.');
        }
        if (actor.organizationId !== req.params.organizationId) throw new DomainError('FORBIDDEN', 'No administrás esta organización.');
        try {
            const scope = await createPrismaStaffAssignment({ actor, email, role, storeId });
            res.status(201).json({ email, role: scope.role, organizationId: scope.organizationId, storeId: scope.storeId });
        } catch (error) {
            if (error instanceof Error && error.message.includes('debe crear')) throw new DomainError('STAFF_USER_NOT_FOUND', error.message);
            if (error instanceof Error && error.message.includes('no pertenece')) throw new DomainError('FORBIDDEN', error.message);
            throw error;
        }
    });

    router.post('/organizations/:organizationId/stores', async (req, res) => {
        const actor = await resolveActor(req);

        if (!actor) {
        throw new DomainError('UNAUTHENTICATED', 'Se requiere autenticación');
        }

        const { name, code } = req.body ?? {};

        if (typeof name !== 'string' || typeof code !== 'string') {
        throw new DomainError('INVALID_REQUEST', 'Los campos name y code son obligatorios y deben ser texto');
        }

        const store = await createStore(actor, {
        organizationId: req.params.organizationId,
        name,
        code,
        });

        res.status(201).json(store);
    });

    return router;
}
