const MINUTE_MS = 60_000;
export const RESERVATION_MINUTES = 5;
const PREPARATION_MINUTES = 15;
const WINDOW_MINUTES = 5;
const TOLERANCE_MINUTES = 5;

export interface StorePickupSchedule {
  timeZone: string;
  opensAtMinute: number;
  digitalClosesAtMinute: number;
  operationalClosesAtMinute: number;
}

export interface TemporalPickupWindow {
  promisedFrom: Date;
  promisedTo: Date;
  toleranceUntil: Date;
}

function localTime(formatter: Intl.DateTimeFormat, instant: Date) {
  const parts = formatter.formatToParts(instant);
  const value = (key: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === key)?.value;
  const day = `${value('year')}-${value('month')}-${value('day')}`;
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return { day, minuteOfDay: hour * 60 + minute };
}

function storeTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

export function pickupCalendarDate(instant: Date, timeZone: string): Date {
  const { day } = localTime(storeTimeFormatter(timeZone), instant);
  return new Date(`${day}T00:00:00.000Z`);
}

export function generateTodayPickupWindows(
  now: Date,
  schedule: StorePickupSchedule,
): TemporalPickupWindow[] {
  const formatter = storeTimeFormatter(schedule.timeZone);
  const today = localTime(formatter, now);
  if (today.minuteOfDay < schedule.opensAtMinute ||
      today.minuteOfDay >= schedule.digitalClosesAtMinute) {
    return [];
  }

  const earliest = now.getTime() + (RESERVATION_MINUTES + PREPARATION_MINUTES) * MINUTE_MS;
  const firstMinute = Math.ceil(earliest / MINUTE_MS) * MINUTE_MS;
  const windows: TemporalPickupWindow[] = [];

  // RN-057 permite comenzar en cualquier minuto. RN-059 excluye el cierre mismo.
  for (let start = firstMinute; ; start += MINUTE_MS) {
    const promisedFrom = new Date(start);
    const promisedTo = new Date(start + WINDOW_MINUTES * MINUTE_MS);
    const toleranceUntil = new Date(promisedTo.getTime() + TOLERANCE_MINUTES * MINUTE_MS);
    const localStart = localTime(formatter, promisedFrom);
    const localEnd = localTime(formatter, toleranceUntil);

    if (localStart.day !== today.day || localEnd.day !== today.day) {
      break;
    }
    if (localStart.minuteOfDay >= schedule.opensAtMinute &&
        localStart.minuteOfDay < schedule.operationalClosesAtMinute &&
        localEnd.minuteOfDay < schedule.operationalClosesAtMinute) {
      windows.push({ promisedFrom, promisedTo, toleranceUntil });
    }
  }

  return windows;
}
