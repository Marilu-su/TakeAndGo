import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ListPickupWindowsUseCase } from '../../../src/modules/order/application/listPickupWindowsUseCase';
import { createDemoStoreSchedule } from '../../../src/modules/order/infrastructure/demoStoreSchedule';

const DEMO_STORE = 'buffet-demo-test';
const demoSchedule = createDemoStoreSchedule(DEMO_STORE);

function listAt(instant: string, storeId = DEMO_STORE) {
  return new ListPickupWindowsUseCase(demoSchedule, () => new Date(instant)).execute(storeId);
}

test('ofrece candidatos consecutivos durante el horario digital', async () => {
  const windows = await listAt('2026-11-27T12:00:00-03:00');
  assert.deepEqual(windows.slice(0, 3).map(window => window.promisedFrom.toISOString()), [
    '2026-11-27T15:20:00.000Z',
    '2026-11-27T15:21:00.000Z',
    '2026-11-27T15:22:00.000Z',
  ]);
});

test('antes de las 08:00 no ofrece ventanas', async () => {
  assert.deepEqual(await listAt('2026-11-27T07:59:59.999-03:00'), []);
});

test('exactamente a las 08:00 ofrece ventanas desde las 08:20', async () => {
  const [first] = await listAt('2026-11-27T08:00:00-03:00');
  assert.equal(first.promisedFrom.toISOString(), '2026-11-27T11:20:00.000Z');
});

test('deja quince minutos incluso si el pago toma cinco minutos', async () => {
  const now = '2026-11-27T12:02:00-03:00';
  const [first] = await listAt(now);
  const lastPossiblePayment = Date.parse(now) + 5 * 60_000;
  assert.equal(first.promisedFrom.getTime() - lastPossiblePayment, 15 * 60_000);
});

test('si hay segundos redondea hacia arriba al minuto siguiente', async () => {
  const [first] = await listAt('2026-11-27T12:02:00.001-03:00');
  assert.equal(first.promisedFrom.toISOString(), '2026-11-27T15:23:00.000Z');
});

test('la ventana dura cinco minutos', async () => {
  const [first] = await listAt('2026-11-27T12:00:00-03:00');
  assert.equal(first.promisedTo.getTime() - first.promisedFrom.getTime(), 5 * 60_000);
});

test('la tolerancia dura cinco minutos adicionales', async () => {
  const [first] = await listAt('2026-11-27T12:00:00-03:00');
  assert.equal(first.toleranceUntil.getTime() - first.promisedTo.getTime(), 5 * 60_000);
});

test('permite retirar después de las 21:00', async () => {
  const [first] = await listAt('2026-11-27T20:59:59.999-03:00');
  assert.equal(first.promisedFrom.toISOString(), '2026-11-28T00:20:00.000Z');
});

test('exactamente a las 21:30 no ofrece ventanas', async () => {
  assert.deepEqual(await listAt('2026-11-27T21:30:00-03:00'), []);
});

test('excluye tolerancias que llegan al cierre operativo o lo superan', async () => {
  const windows = await listAt('2026-11-27T20:59:59.999-03:00');
  assert.equal(windows.length, 30);
  assert.equal(windows.at(-1)?.toleranceUntil.toISOString(), '2026-11-28T00:59:00.000Z');
});

test('solo ofrece ventanas del día del buffet aunque en UTC ya sea mañana', async () => {
  const windows = await listAt('2026-11-27T20:59:59.999-03:00');
  const localDay = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
  });
  assert.ok(windows.length > 0);
  for (const window of windows) {
    assert.equal(localDay.format(window.promisedFrom), '27');
    assert.equal(localDay.format(window.toleranceUntil), '27');
  }
});

test('interpreta apertura y cierre en la zona del buffet para instantes UTC', async () => {
  assert.deepEqual(await listAt('2026-11-27T10:59:00Z'), []);
  const [first] = await listAt('2026-11-27T11:00:00Z');
  assert.equal(first.promisedFrom.toISOString(), '2026-11-27T11:20:00.000Z');
  assert.deepEqual(await listAt('2026-11-28T00:30:00Z'), []);
});

test('un buffet sin configuración no hereda el horario de demo', async () => {
  assert.deepEqual(await listAt('2026-11-27T12:00:00-03:00', 'otro-buffet'), []);
});
