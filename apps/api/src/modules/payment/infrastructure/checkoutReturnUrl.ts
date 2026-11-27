/** URL de la web a la que vuelve el cliente después del checkout (contrato MVP-05). */
export function checkoutReturnUrl(frontendUrl: string, orderId: string): string {
  const base = frontendUrl.replace(/\/+$/, '');
  return `${base}/pedidos/${encodeURIComponent(orderId)}?pago=retorno`;
}
