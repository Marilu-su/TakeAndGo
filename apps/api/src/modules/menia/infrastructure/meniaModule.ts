import { createPrismaListCustomerStores } from '../../customer/infrastructure/customerModule';
import { createPrismaGetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import { createPrismaStoreCatalogUseCases } from '../../catalog/infrastructure/catalogModule';
import { makeMeniaUseCases } from '../application/meniaUseCases';
import type { MeniaDependencies, MeniaResponder } from '../application/ports';
import { DeterministicMeniaResponder } from './deterministicResponder';
import { GeminiMeniaClient } from './geminiMeniaClient';
import { LlmMeniaResponder } from './llmResponder';

function createMeniaResponder(): MeniaResponder {
  const provider = (process.env.MENIA_PROVIDER ?? '').trim().toLowerCase();
  const apiKey = (process.env.MENIA_API_KEY ?? '').trim();
  const model = (process.env.MENIA_MODEL ?? 'gemini-3.5-flash-lite').trim();

  if (provider === 'gemini' && apiKey) {
    const client = new GeminiMeniaClient({ apiKey, model });
    return new LlmMeniaResponder(client);
  }

  return new DeterministicMeniaResponder();
}

export function createMeniaModule(
  overrides: Partial<MeniaDependencies> = {},
) {
  const getConfiguration = createPrismaGetStoreConfiguration();
  const getStoreCatalog = createPrismaStoreCatalogUseCases().getStoreCatalog;
  return makeMeniaUseCases({
    getStore: overrides.getStore ?? (async id => (await getConfiguration(id)).store),
    listCustomerStores: overrides.listCustomerStores ?? createPrismaListCustomerStores(),
    getCatalog: overrides.getCatalog ?? (storeId => getStoreCatalog(storeId)),
    responder: overrides.responder ?? createMeniaResponder(),
  });
}