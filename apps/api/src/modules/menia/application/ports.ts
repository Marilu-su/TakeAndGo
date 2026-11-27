import type { MeniaContext, MeniaReply } from '../domain/conversation';

export type MeniaStore = {
  id: string;
  name: string;
  organizationId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_SETUP';
};

export interface MeniaResponder {
  respond(input: { message: string; context: MeniaContext }): Promise<MeniaReply>;
}

export type MeniaDependencies = {
  getStore: (storeId: string) => Promise<MeniaStore>;
  listCustomerStores: (customerId: string) => Promise<ReadonlyArray<{ id: string }>>;
  responder: MeniaResponder;
};
