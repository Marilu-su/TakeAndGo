import { createPrismaListCustomerStores } from '../../customer/infrastructure/customerModule';
import { createPrismaGetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import { makeMeniaUseCases } from '../application/meniaUseCases';
import { DeterministicMeniaResponder } from './deterministicResponder';

export function createMeniaModule() {
  const getConfiguration = createPrismaGetStoreConfiguration();
  return makeMeniaUseCases({
    getStore: async id => (await getConfiguration(id)).store,
    listCustomerStores: createPrismaListCustomerStores(),
    responder: new DeterministicMeniaResponder(),
  });
}
