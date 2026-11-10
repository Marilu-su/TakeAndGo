import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

const { createMeniaConversation, validMeniaMessage, meniaPath } = await loadTs('lib/menia.ts');
const { ApiError } = await loadTs('lib/api.ts');
const reply = (storeId = 'store-1') => ({ context: { storeId }, message: { role: 'assistant', text: 'Respuesta real' }, cards: [], actions: [] });

test('MenIA cliente: mensaje válido, límites y ruta del buffet codificada', () => {
  assert.equal(validMeniaMessage('   '), false);
  assert.equal(validMeniaMessage('a'.repeat(2001)), false);
  assert.equal(validMeniaMessage('a'.repeat(2000)), true);
  assert.equal(meniaPath('a/b'), '/buffets/a%2Fb/menia');
});

test('MenIA cliente: envía al buffet elegido y evita duplicados mientras espera', async () => {
  let complete;
  let calls = 0;
  const conversation = createMeniaConversation('store-1', async (path, options) => {
    calls++;
    assert.equal(path, '/api/v1/stores/store-1/menia/messages');
    assert.deepEqual(JSON.parse(options.body), { message: 'Hola' });
    return new Promise(resolve => { complete = resolve; });
  });
  await conversation.send(' ');
  assert.equal(calls, 0);
  const pending = conversation.send(' Hola ');
  assert.equal(conversation.getSnapshot().pending, true);
  await conversation.send('Duplicado');
  assert.equal(calls, 1);
  complete(reply());
  await pending;
  assert.deepEqual(conversation.getSnapshot().messages, [{ role: 'user', text: 'Hola' }, reply().message]);
  assert.equal(conversation.getSnapshot().pending, false);
});

test('MenIA cliente: reintenta errores de red sin duplicar el mensaje del usuario', async () => {
  let calls = 0;
  const conversation = createMeniaConversation('store-1', async () => {
    if (++calls === 1) throw new ApiError('No se pudo conectar');
    return reply();
  });
  await conversation.send('Hola');
  assert.equal(conversation.getSnapshot().retryable, true);
  await conversation.retry();
  assert.equal(conversation.getSnapshot().messages.length, 2);
  assert.equal(conversation.getSnapshot().error, '');
});

test('MenIA cliente: autorización denegada impide nuevos envíos y reintentos', async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0;
    const conversation = createMeniaConversation('store-1', async () => { calls++; throw new ApiError('Denegado', status); });
    await conversation.send('Hola');
    await conversation.retry();
    await conversation.send('Otra consulta');
    assert.equal(calls, 1);
    assert.equal(conversation.getSnapshot().forbidden, true);
    assert.equal(conversation.getSnapshot().retryable, false);
  }
});

test('MenIA cliente: rechaza respuestas vacías, inválidas o de otro buffet', async () => {
  for (const response of [null, {}, reply('store-2'), { ...reply(), message: { role: 'assistant', text: '' } }]) {
    const conversation = createMeniaConversation('store-1', async () => response);
    await conversation.send('Hola');
    assert.equal(conversation.getSnapshot().messages.length, 1);
    assert.match(conversation.getSnapshot().error, /no está disponible/);
  }
});

test('MenIA cliente: conversaciones nuevas no conservan mensajes de otros buffets', async () => {
  const first = createMeniaConversation('store-1', async () => reply());
  await first.send('Consulta privada');
  first.dispose();
  const second = createMeniaConversation('store-2', async () => reply('store-2'));
  assert.deepEqual(second.getSnapshot().messages, []);
  assert.deepEqual(createMeniaConversation('store-1').getSnapshot().messages, []);
});
