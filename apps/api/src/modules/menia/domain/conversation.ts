export const MAX_MESSAGE_LENGTH = 2000;

export type MeniaContext = {
  storeId: string;
  storeName: string;
  organizationId: string;
};

export type MeniaMessageRequest = { message: string };
export type MeniaCard = { type: 'product' | 'recommendation'; id: string; title: string };
export type MeniaAction = { type: 'confirm_order'; id: string; label: string };
export type MeniaReply = {
  message: { role: 'assistant'; text: string };
  cards: MeniaCard[];
  actions: MeniaAction[];
};
export type MeniaMessageResponse = MeniaReply & { context: MeniaContext };
