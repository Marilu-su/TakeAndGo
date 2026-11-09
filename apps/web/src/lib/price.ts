export function parsePriceCents(input: string): number {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Ingresá un precio válido con hasta dos decimales.');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole + fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 2147483647) throw new Error('El precio supera el máximo admitido.');
  return cents;
}
