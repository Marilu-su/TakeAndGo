import { Router } from 'express';
import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';
import type { CustomerPreferences } from '../customerModule';

const DIETARY_RESTRICTIONS = new Set(['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE']);
type PreferencesStore = ReturnType<typeof import('../customerModule').createPrismaCustomerPreferences>;

function normalizeLabels(value: unknown, field: string, max: number, allowed?: Set<string>): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string')) {
    throw new DomainError('INVALID_REQUEST', `${field} debe ser una lista válida de hasta ${max} opciones.`);
  }
  const labels = [...new Map((value as string[]).map(item => item.trim()).filter(Boolean).map(item => [item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(), item.trim().slice(0, 80)])).values()];
  if (allowed && labels.some(item => !allowed.has(item))) throw new DomainError('INVALID_REQUEST', 'Elegí una preferencia dietaria válida.');
  return labels;
}

export function createCustomerPreferencesRouter(resolveActor: ActorResolver, preferences: PreferencesStore) {
  const router = Router();
  router.get('/me/preferences', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente.');
    try { res.json(await preferences.get(actor.userId)); }
    catch (error) { if (error instanceof Error && error.message === 'CUSTOMER_NOT_FOUND') throw new DomainError('NOT_FOUND', 'No se encontró el perfil de cliente.'); throw error; }
  });
  router.patch('/me/preferences', async (req, res) => {
    const actor = await requireActor(resolveActor, req);
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'Se requiere un perfil de cliente.');
    const body = req.body ?? {};
    if (!Array.isArray(body.dietaryRestrictions) || !Array.isArray(body.allergies)) throw new DomainError('INVALID_REQUEST', 'Indicá restricciones dietarias y alergias como listas.');
    const dietaryRestrictions = normalizeLabels(body.dietaryRestrictions, 'Las restricciones dietarias', 3, DIETARY_RESTRICTIONS);
    if (dietaryRestrictions.includes('VEGAN') && !dietaryRestrictions.includes('VEGETARIAN')) dietaryRestrictions.push('VEGETARIAN');
    const allergies = normalizeLabels(body.allergies, 'Las alergias', 30);
    try { res.json(await preferences.save(actor.userId, { dietaryRestrictions, allergies } satisfies CustomerPreferences)); }
    catch (error) { if (error instanceof Error && error.message === 'CUSTOMER_NOT_FOUND') throw new DomainError('NOT_FOUND', 'No se encontró el perfil de cliente.'); throw error; }
  });
  return router;
}
