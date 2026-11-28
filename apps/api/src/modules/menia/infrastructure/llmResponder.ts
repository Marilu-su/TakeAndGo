import { DomainError } from '../../../shared/domain/DomainError';
import type { MeniaCard, MeniaContext, MeniaReply } from '../domain/conversation';
import type { MeniaCatalog, MeniaCatalogProduct, MeniaResponder } from '../application/ports';

export type MeniaModelPrompt = {
  message: string;
  context: MeniaContext;
  availableProducts: ReadonlyArray<{
    id: string;
    categoryName: string;
    name: string;
    description: string | null;
    priceCents: number;
    dietaryTags: string[];
    allergens: string[];
  }>;
};

export type MeniaModelOutput = {
  text: string;
  recommendedProductIds?: string[];
};

export interface MeniaModelClient {
  generateRecommendation(prompt: MeniaModelPrompt): Promise<MeniaModelOutput>;
}

function flattenAvailableProducts(catalog?: MeniaCatalog): Array<{
  categoryName: string;
  product: MeniaCatalogProduct;
}> {
  if (!catalog) return [];
  return catalog.categories.flatMap(category =>
    category.products.map(product => ({ categoryName: category.name, product })),
  );
}

export class LlmMeniaResponder implements MeniaResponder {
  constructor(private readonly client: MeniaModelClient) {}

  async respond(input: {
    message: string;
    context: MeniaContext;
    catalog?: MeniaCatalog;
  }): Promise<MeniaReply> {
    const entries = flattenAvailableProducts(input.catalog);
    const availableById = new Map(entries.map(entry => [entry.product.id, entry.product]));

    const output = await this.client.generateRecommendation({
      message: input.message,
      context: input.context,
      availableProducts: entries.map(({ categoryName, product }) => ({
        id: product.id,
        categoryName,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        dietaryTags: product.dietaryTags,
        allergens: product.allergens,
      })),
    });

    const text = typeof output?.text === 'string' ? output.text.trim() : '';
    if (!text) {
      throw new DomainError('INTERNAL_ERROR', 'El proveedor del modelo devolvió una respuesta vacía.');
    }

    const cards: MeniaCard[] = [];
    const seenIds = new Set<string>();
    for (const productId of output.recommendedProductIds ?? []) {
      if (seenIds.has(productId)) continue;
      const matched = availableById.get(productId);
      if (!matched) continue;
      seenIds.add(productId);
      cards.push({ type: 'product', id: matched.id, title: matched.name });
    }

    return {
      message: { role: 'assistant', text },
      cards,
      actions: [],
    };
  }
}