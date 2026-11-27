
/**
 * Resultado de un pago según el proveedor.
 * PENDING agrupa todo lo que todavía no es definitivo (en proceso, pendiente, etc.).
 */
export type ProviderPaymentStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

export interface ProviderPayment {
  providerPaymentId: string;
  // Id de nuestro pago (Payment.id), enviado como referencia externa al crear el checkout.
  externalReference: string | null;
  status: ProviderPaymentStatus;
  amountCents: number;
}

export interface PaymentStatusPort {
  /** Busca un pago del proveedor por su id (el que llega en el aviso). */
  getPayment(providerPaymentId: string): Promise<ProviderPayment | null>;

  /** Busca el resultado de nuestro pago (Payment.id) en el proveedor. */
  findPaymentByReference(payment: { id: string; amountCents: number }): Promise<ProviderPayment | null>;
}
