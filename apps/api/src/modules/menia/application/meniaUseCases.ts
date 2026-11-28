import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import {
  MAX_MESSAGE_LENGTH,
  type MeniaCard,
  type MeniaContext,
  type MeniaMessageResponse,
} from '../domain/conversation';
import type { MeniaCatalog, MeniaDependencies } from './ports';

function collectAvailableCatalogKeys(catalog: MeniaCatalog): {
  ids: Set<string>;
  titles: Set<string>;
  totalProducts: number;
} {
  const ids = new Set<string>();
  const titles = new Set<string>();
  let totalProducts = 0;

  for (const category of catalog.categories) {
    for (const product of category.products) {
      totalProducts += 1;
      ids.add(product.id);
      titles.add(product.name.trim().toLowerCase());
    }
  }

  return { ids, titles, totalProducts };
}

function filterAvailableCards(cards: MeniaCard[], catalog?: MeniaCatalog): MeniaCard[] {
  if (!catalog) return cards;
  const { ids, titles } = collectAvailableCatalogKeys(catalog);
  return cards.filter(
    card => ids.has(card.id) || titles.has(card.title.trim().toLowerCase()),
  );
}

export function makeMeniaUseCases(deps: MeniaDependencies) {
  async function getContext(actor: Actor, storeId: string): Promise<MeniaContext> {
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'MenIA requiere un perfil de cliente.');
    const store = await deps.getStore(storeId);
    const stores = await deps.listCustomerStores(actor.userId);
    if (!stores.some(candidate => candidate.id === store.id)) {
      throw new DomainError('FORBIDDEN', 'No estás asociado a este buffet.');
    }
    if (store.status !== 'ACTIVE') throw new DomainError('FORBIDDEN', 'Este buffet no está activo.');
    return { storeId: store.id, storeName: store.name, organizationId: store.organizationId };
  }

  async function sendMessage(actor: Actor, storeId: string, body: unknown): Promise<MeniaMessageResponse> {
    if (actor.role !== 'CUSTOMER') throw new DomainError('FORBIDDEN', 'MenIA requiere un perfil de cliente.');
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => key !== 'message') ||
        !('message' in body) || typeof body.message !== 'string' ||
        !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
      throw new DomainError('INVALID_REQUEST', `Escribí un mensaje de hasta ${MAX_MESSAGE_LENGTH} caracteres.`);
    }
    const context = await getContext(actor, storeId);
    const catalog = deps.getCatalog ? await deps.getCatalog(context.storeId) : undefined;

    if (catalog && collectAvailableCatalogKeys(catalog).totalProducts === 0) {
      return {
        message: {
          role: 'assistant',
          text: 'Por el momento no hay productos disponibles en el catálogo de este buffet.',
        },
        cards: [],
        actions: [],
        context,
      };
    }

    const reply = await deps.responder.respond({ message: body.message.trim(), context, catalog });
    return {
      ...reply,
      cards: filterAvailableCards(reply.cards, catalog),
      context,
    };
  }

  return { getContext, sendMessage };
}

export type MeniaUseCases = ReturnType<typeof makeMeniaUseCases>;