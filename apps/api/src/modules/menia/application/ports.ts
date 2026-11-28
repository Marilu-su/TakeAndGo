import type { MeniaContext, MeniaReply } from '../domain/conversation';

export type MeniaStore = {
  id: string;
  name: string;
  organizationId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_SETUP';
};

export type MeniaCatalogAddition = {
  id: string;
  name: string;
  priceCents: number;
};

export type MeniaCatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  basePreparationSeconds: number;
  dietaryTags: string[];
  allergens: string[];
  allergensVerified: boolean;
  additions: MeniaCatalogAddition[];
};

export type MeniaCatalogCategory = {
  id: string;
  name: string;
  products: MeniaCatalogProduct[];
};

export type MeniaCatalog = {
  storeId: string;
  categories: MeniaCatalogCategory[];
};

export interface MeniaResponder {
  respond(input: {
    message: string;
    context: MeniaContext;
    catalog?: MeniaCatalog;
  }): Promise<MeniaReply>;
}

export type MeniaDependencies = {
  getStore: (storeId: string) => Promise<MeniaStore>;
  listCustomerStores: (customerId: string) => Promise<ReadonlyArray<{ id: string }>>;
  getCatalog?: (storeId: string) => Promise<MeniaCatalog>;
  responder: MeniaResponder;
};