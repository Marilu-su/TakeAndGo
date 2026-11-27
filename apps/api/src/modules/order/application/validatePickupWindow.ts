import { DomainError } from '../../../shared/domain/DomainError';
import { generateTodayPickupWindows, pickupCalendarDate, type StorePickupSchedule } from '../domain/pickupWindow';

export function parsePromisedFrom(value: unknown): Date {
  if (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) {
    const day = value.slice(0, 10);
    const calendarDate = new Date(`${day}T00:00:00.000Z`);
    if (Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().startsWith(day)) {
      return new Date(value);
    }
  }
  throw new DomainError('INVALID_REQUEST', 'Indicá promisedFrom como fecha ISO 8601 con zona horaria');
}

export function validatePickupWindow(now: Date, promisedFrom: Date, schedule: StorePickupSchedule | null) {
  const window = schedule && generateTodayPickupWindows(now, schedule)
    .find(candidate => candidate.promisedFrom.getTime() === promisedFrom.getTime());
  if (!schedule || !window) {
    throw new DomainError('PICKUP_WINDOW_UNAVAILABLE', 'La ventana de retiro ya no está disponible. Consultá las opciones de hoy.');
  }

  return { ...window, scheduledForDate: pickupCalendarDate(window.promisedFrom, schedule.timeZone) };
}
