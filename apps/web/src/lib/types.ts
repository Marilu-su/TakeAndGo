export type Store = { id: string; name: string; code: string; organizationId: string; status: string };
export type Addition = { id: string; name: string; priceCents: number; isActive?: boolean };
export type Product = { id: string; name: string; description: string | null; priceCents: number; basePreparationSeconds: number; additions: Addition[]; categoryId?: string; isActive?: boolean };
export type Category = { id: string; name: string; isActive?: boolean };
export type Catalog = { storeId: string; categories: (Category & { products: Product[] })[] };
export const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
