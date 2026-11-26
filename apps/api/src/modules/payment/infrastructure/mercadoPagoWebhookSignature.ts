import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookSignatureInput {
  secret: string;
  // Header x-signature: "ts=1704908010,v1=618c8534..."
  signature: string | undefined;
  // Header x-request-id
  requestId: string | undefined;
  // Parámetro data.id de la URL del aviso
  dataId: string | undefined;
}

/**
 * Valida la firma de un aviso de Mercado Pago (HMAC SHA-256 con la clave secreta del webhook).
 * Plantilla firmada: "id:[data.id];request-id:[x-request-id];ts:[ts];"
 */
export function isValidMercadoPagoSignature(input: WebhookSignatureInput): boolean {
  if (!input.signature) {
    return false;
  }

  const parts = new Map(
    input.signature.split(',').map(part => {
      const [key, ...value] = part.split('=');
      return [key.trim(), value.join('=').trim()] as const;
    }),
  );

  const ts = parts.get('ts');
  const v1 = parts.get('v1');

  if (!ts || !v1) {
    return false;
  }

  // Mercado Pago firma el id en minúsculas cuando es alfanumérico.
  const dataId = input.dataId && /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;

  let manifest = '';
  if (dataId) manifest += `id:${dataId};`;
  if (input.requestId) manifest += `request-id:${input.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');

  const received = Buffer.from(v1, 'utf8');
  const computed = Buffer.from(expected, 'utf8');

  return received.length === computed.length && timingSafeEqual(received, computed);
}
