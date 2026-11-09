export type CartLine = {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  additions: { id: string; name: string; priceCents: number }[];
};
export function lineKey(line: Pick<CartLine, 'productId' | 'additions'>) {
  return JSON.stringify([line.productId, line.additions.map(a => a.id).sort()]);
}
export function cartTotal(lines: CartLine[]) {
  const total = lines.reduce((sum, line) => sum + (line.priceCents + line.additions.reduce((n, a) => n + a.priceCents, 0)) * line.quantity, 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > 2147483647) throw new Error('El total supera el máximo admitido.');
  return total;
}
export function addCartLine(lines: CartLine[], item: CartLine): CartLine[] {
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) throw new Error('La cantidad debe ser un entero positivo.');
  const key = lineKey(item);
  const found = lines.some(line => lineKey(line) === key);
  const result = found ? lines.map(line => lineKey(line) === key ? { ...line, quantity: line.quantity + item.quantity } : line) : [...lines, item];
  if (result.some(line => !Number.isSafeInteger(line.quantity) || line.quantity > 2147483647)) throw new Error('La cantidad supera el máximo admitido.');
  cartTotal(result);
  return result;
}
