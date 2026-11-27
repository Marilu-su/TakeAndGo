import { DomainError } from '../../../shared/domain/DomainError';

// Take&Go opera en buffets de Argentina: UTC-3 todo el año, sin horario de verano.
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_COUNTED_STOCK = 100000;
const MAX_ITEMS = 500;

export type WeeklyReviewItem = {
    productId?: string;
    additionId?: string;
    countedStock: number;
};

/** Lunes a las 00:00 (hora argentina) de la semana de `now`. */
export function startOfWeek(now: Date): Date {
    const local = new Date(now.getTime() - ARGENTINA_OFFSET_MS);
    const daysSinceMonday = (local.getUTCDay() + 6) % 7;
    const mondayUtcMidnight = Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - daysSinceMonday,
    );

    return new Date(mondayUtcMidnight + ARGENTINA_OFFSET_MS);
    }

    export function parseWeeklyReviewItems(raw: unknown): WeeklyReviewItem[] {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
        throw new DomainError('INVALID_REQUEST', 'Indicá al menos un producto o adicional contado.');
    }

    const seen = new Set<string>();

    return raw.map((value: unknown) => {
        const item = (value ?? {}) as Record<string, unknown>;
        const { productId, additionId, countedStock } = item;
        const hasProduct = typeof productId === 'string' && productId.length > 0;
        const hasAddition = typeof additionId === 'string' && additionId.length > 0;

        if (hasProduct === hasAddition) {
        throw new DomainError('INVALID_REQUEST', 'Cada ítem debe indicar un producto o un adicional.');
        }

        if (!Number.isSafeInteger(countedStock) || (countedStock as number) < 0 || (countedStock as number) > MAX_COUNTED_STOCK) {
        throw new DomainError('INVALID_REQUEST', 'La cantidad contada debe ser un entero entre 0 y 100000.');
        }

        const key = hasProduct ? `p:${productId}` : `a:${additionId}`;

        if (seen.has(key)) {
        throw new DomainError('INVALID_REQUEST', 'Un producto o adicional aparece más de una vez en la revisión.');
        }

        seen.add(key);

        return hasProduct
        ? { productId: productId as string, countedStock: countedStock as number }
        : { additionId: additionId as string, countedStock: countedStock as number };
    });
}