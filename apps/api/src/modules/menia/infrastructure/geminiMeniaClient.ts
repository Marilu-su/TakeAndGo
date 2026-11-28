import { DomainError } from '../../../shared/domain/DomainError';
import type {
  MeniaModelClient,
  MeniaModelOutput,
  MeniaModelPrompt,
} from './llmResponder';

export type GeminiMeniaClientConfig = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

export class GeminiMeniaClient implements MeniaModelClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: GeminiMeniaClientConfig) {
    this.apiKey = config.apiKey.trim();
    this.model = config.model.trim() || 'gemini-2.5-flash';
    this.timeoutMs = config.timeoutMs ?? 12000;
  }

  async generateRecommendation(prompt: MeniaModelPrompt): Promise<MeniaModelOutput> {
    if (!this.apiKey) {
      throw new DomainError('INTERNAL_ERROR', 'Falta MENIA_API_KEY para consultar MenIA.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const systemInstruction = [
      'Sos MenIA, el asistente de recomendación de productos de un buffet.',
      'Respondé en español rioplatense claro, breve y amable.',
      'SOLO podés recomendar productos presentes en availableProducts; nunca inventes productos ni precios.',
      'Devolvé ÚNICAMENTE un JSON válido con este formato exacto:',
      '{"text": "respuesta breve", "recommendedProductIds": ["id1", "id2"]}',
      'Si no hay productos adecuados o el catálogo está vacío, devolvé recommendedProductIds como [].',
    ].join('\n');

    const userPayload = {
      mensajeCliente: prompt.message,
      contexto: prompt.context,
      productosDisponibles: prompt.availableProducts,
    };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: JSON.stringify(userPayload) }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new DomainError(
          'INTERNAL_ERROR',
          `Error de Gemini (${response.status}): ${errorBody.slice(0, 200)}`,
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!rawText) {
        throw new DomainError('INTERNAL_ERROR', 'Gemini devolvió una respuesta vacía.');
      }

      const parsed = JSON.parse(rawText) as {
        text?: unknown;
        recommendedProductIds?: unknown;
      };

      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      const recommendedProductIds = Array.isArray(parsed.recommendedProductIds)
        ? parsed.recommendedProductIds.filter((id): id is string => typeof id === 'string')
        : [];

      if (!text) {
        throw new DomainError('INTERNAL_ERROR', 'El JSON de Gemini no incluía texto válido.');
      }

      return { text, recommendedProductIds };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new DomainError('INTERNAL_ERROR', 'Timeout al consultar el modelo de MenIA.');
      }
      throw new DomainError('INTERNAL_ERROR', 'Falló la comunicación con el proveedor LLM de MenIA.');
    } finally {
      clearTimeout(timer);
    }
  }
}