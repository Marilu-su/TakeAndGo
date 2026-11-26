import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { isValidMercadoPagoSignature } from '../../../src/modules/payment/infrastructure/mercadoPagoWebhookSignature';

const SECRET = 'clave-de-prueba';

function sign(manifest: string, secret = SECRET) {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

test('firma: acepta un aviso firmado con la clave del webhook', () => {
  const v1 = sign('id:123456;request-id:req-1;ts:1704908010;');

  assert.equal(
    isValidMercadoPagoSignature({ secret: SECRET, signature: `ts=1704908010,v1=${v1}`, requestId: 'req-1', dataId: '123456' }),
    true,
  );
});

test('firma: el id alfanumérico se firma en minúsculas', () => {
  const v1 = sign('id:abc123;request-id:req-1;ts:1;');

  assert.equal(
    isValidMercadoPagoSignature({ secret: SECRET, signature: `ts=1,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123' }),
    true,
  );
});

test('firma: rechaza firmas ausentes, alteradas o con otra clave', () => {
  const good = sign('id:123456;request-id:req-1;ts:1;');
  const base = { secret: SECRET, requestId: 'req-1', dataId: '123456' };

  assert.equal(isValidMercadoPagoSignature({ ...base, signature: undefined }), false);
  assert.equal(isValidMercadoPagoSignature({ ...base, signature: 'basura' }), false);
  assert.equal(isValidMercadoPagoSignature({ ...base, signature: `ts=1,v1=${good}`, dataId: '999' }), false);
  assert.equal(isValidMercadoPagoSignature({ ...base, signature: `ts=2,v1=${good}` }), false);
  assert.equal(
    isValidMercadoPagoSignature({ ...base, signature: `ts=1,v1=${sign('id:123456;request-id:req-1;ts:1;', 'otra')}` }),
    false,
  );
});
