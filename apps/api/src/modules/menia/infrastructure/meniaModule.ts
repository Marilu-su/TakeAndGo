import { createPrismaListCustomerStores } from '../../customer/infrastructure/customerModule';
import { createPrismaGetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import { makeMeniaUseCases } from '../application/meniaUseCases';
import type { MeniaResponder } from '../application/ports';
import { DeterministicMeniaResponder } from './deterministicResponder';
import { GeminiMeniaClient } from './geminiMeniaClient';
import { LlmMeniaResponder } from './llmResponder';

function createMeniaResponder(): MeniaResponder {
  const provider = (process.env.MENIA_PROVIDER ?? '').trim().toLowerCase();
  const apiKey = (process.env.MENIA_API_KEY ?? '').trim();
  const model = (process.env.MENIA_MODEL ?? 'gemini-2.5-flash').trim();

  if (provider === 'gemini' && apiKey) {
    const client = new GeminiMeniaClient({ apiKey, model });
    return new LlmMeniaResponder(client);
  }

  return new DeterministicMeniaResponder();
}

export function createMeniaModule() {
  const getConfiguration = createPrismaGetStoreConfiguration();
  return makeMeniaUseCases({
    getStore: async id => (await getConfiguration(id)).store,
    listCustomerStores: createPrismaListCustomerStores(),
    responder: createMeniaResponder(),
  });
}