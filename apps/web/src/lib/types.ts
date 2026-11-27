export type Store = { id: string; name: string; code: string; organizationId: string; status: string };
export type Addition = { id: string; name: string; priceCents: number; isActive?: boolean };
export type Product = { id: string; name: string; description: string | null; priceCents: number; basePreparationSeconds: number; additions: Addition[]; categoryId?: string; isActive?: boolean; dietaryTags?: string[]; allergens?: string[]; allergensVerified?: boolean };
export type Category = { id: string; name: string; isActive?: boolean };
export type Catalog = { storeId: string; categories: (Category & { products: Product[] })[] };
export const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
export type PickupWindow = { promisedFrom: string; promisedTo: string; toleranceUntil: string };
export type PickupWindowAvailability = { requiresPickupWindow: boolean; windows: PickupWindow[] };
export type Order = {
  id: string; storeId: string; orderNumber: number; status: string; totalCents: number;
  reservedUntil: string | null; createdAt: string;
  scheduledForDate?: string | null;
  promisedFrom?: string | null;
  promisedTo?: string | null;
  toleranceUntil?: string | null;
  items: { productNameSnapshot: string; quantity: number; subtotalCents: number; additions: { additionNameSnapshot: string }[] }[];
};
export const orderStatus: Record<string, string> = { RESERVED: 'Reservado', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', READY_FOR_PICKUP: 'Listo para retirar', COMPLETED: 'Completado', CANCELLED: 'Cancelado', EXPIRED: 'Reserva vencida' };
