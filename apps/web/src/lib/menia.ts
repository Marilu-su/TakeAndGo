import { sessionRequest } from './session';
import { ApiError } from './api';

export const MAX_MENIA_MESSAGE_LENGTH = 2000;
export type MeniaContext = { storeId: string; storeName: string; organizationId: string };
export type ChatMessage = { role: 'user' | 'assistant'; text: string };
export type MeniaResponse = {
  message: { role: 'assistant'; text: string };
  cards: unknown[];
  actions: unknown[];
  context: MeniaContext;
};
export type ConversationState = {
  messages: ChatMessage[];
  pending: boolean;
  error: string;
  retryable: boolean;
  forbidden: boolean;
};
export type MeniaRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
export const meniaPath = (storeId: string) => `/buffets/${encodeURIComponent(storeId)}/menia`;
export const validMeniaMessage = (text: string) => !!text.trim() && text.length <= MAX_MENIA_MESSAGE_LENGTH;

export function createMeniaConversation(storeId: string, request: MeniaRequest = sessionRequest) {
  let state: ConversationState = { messages: [], pending: false, error: '', retryable: false, forbidden: false };
  let failedText: string | undefined;
  let disposed = false;
  const listeners = new Set<() => void>();
  function update(changes: Partial<ConversationState>) {
    if (disposed) return;
    state = { ...state, ...changes };
    listeners.forEach(listener => listener());
  }
  async function send(text: string, retry = false) {
    if (disposed || state.pending || state.forbidden || !validMeniaMessage(text)) return;
    const message = text.trim();
    failedText = undefined;
    update({ pending: true, error: '', retryable: false,
      messages: retry ? state.messages : [...state.messages, { role: 'user', text: message }],
    });
    try {
      const response = await request<MeniaResponse>(`/api/v1/stores/${encodeURIComponent(storeId)}/menia/messages`, {
        method: 'POST', body: JSON.stringify({ message }),
      });
      if (response?.context?.storeId !== storeId || response?.message?.role !== 'assistant' ||
          typeof response.message.text !== 'string' || !response.message.text.trim() ||
          !Array.isArray(response.cards) || !Array.isArray(response.actions)) {
        throw new Error('La respuesta de MenIA no está disponible. Podés reintentar.');
      }
      update({ messages: [...state.messages, response.message] });
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : undefined;
      const forbidden = status === 401 || status === 403 || status === 404;
      const retryable = status === undefined || status >= 500 || status === 429;
      failedText = retryable ? message : undefined;
      update({ error: forbidden ? 'No tenés acceso a esta conversación. Revisá tu sesión y el buffet seleccionado.'
        : cause instanceof Error ? cause.message : 'No se pudo conectar con MenIA.', forbidden, retryable });
    } finally { update({ pending: false }); }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    send: (text: string) => send(text),
    retry: () => failedText ? send(failedText, true) : Promise.resolve(),
    dispose: () => { disposed = true; listeners.clear(); },
  };
}
