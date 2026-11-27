import type { MeniaResponder } from '../application/ports';

export class DeterministicMeniaResponder implements MeniaResponder {
  async respond(): ReturnType<MeniaResponder['respond']> {
    return {
      message: {
        role: 'assistant',
        text: 'Recibí tu mensaje. MenIA está en preparación: la interpretación inteligente se incorporará próximamente. Mientras tanto, podés consultar el catálogo del buffet. No se creó ningún pedido.',
      },
      cards: [],
      actions: [],
    };
  }
}
