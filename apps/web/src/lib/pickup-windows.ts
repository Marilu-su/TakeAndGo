import type { CartLine } from './cart';
import type { Order, PickupWindowAvailability } from './types';

const timeZone = 'America/Argentina/Buenos_Aires';
const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone, dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23',
});

export function pickupWindowsPath(storeId: string) {
  return `/api/v1/stores/${encodeURIComponent(storeId)}/pickup-windows`;
}

export function resolvePickupSelection(availability: PickupWindowAvailability | undefined, selected: string) {
  const window = availability?.windows.find(window => window.promisedFrom === selected);
  return { window, expired: !!(availability && selected && !window) };
}

export function formatPickupTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function formatPickupDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function orderPickupSummary(order: Pick<Order, 'promisedFrom' | 'promisedTo' | 'toleranceUntil'>) {
  if (!order.promisedFrom || !order.promisedTo) return null;
  return {
    window: `${formatPickupDateTime(order.promisedFrom)}–${formatPickupTime(order.promisedTo)}`,
    tolerance: order.toleranceUntil ? formatPickupTime(order.toleranceUntil) : null,
  };
}

export function orderRequestBody(storeId: string, lines: CartLine[], promisedFrom?: string) {
  return JSON.stringify({
    storeId,
    items: lines.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      additionIds: line.additions.map(addition => addition.id),
    })),
    promisedFrom,
  });
}
