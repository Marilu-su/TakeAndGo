import type { Payment } from '../domain/payment';
import type { PaymentRepository } from '../domain/paymentRepository';
import type { PaymentStatusPort, ProviderPayment } from '../domain/paymentStatusPort';
import type { PaymentResult } from './processPaymentResultUseCase';

export interface PaymentResultProcessor {
  execute(paymentId: string, result: PaymentResult): Promise<Payment>;
}

// Otro aviso (o una consulta simultánea) ya aplicó el resultado: no es un error.
const ALREADY_APPLIED = new Set(['PAYMENT_STATE_CONFLICT', 'PAYMENT_ORDER_STATE_CONFLICT']);

// Aprobación después del vencimiento: no confirma el pedido y se reembolsa (MVP-08).
// ORDER_NOT_EXPIRED: el pago venció pero el proceso periódico todavía no venció el pedido;
// lo reembolsa en su próxima pasada (cada 30 segundos).
const LATE_APPROVAL = new Set([
  'ORDER_NOT_RESERVED',
  'PAYMENT_EXPIRED',
  'LATE_PAYMENT_COMPENSATED',
  'ORDER_NOT_EXPIRED',
]);

/**
 * Aplica en nuestro sistema el resultado que informa el proveedor.
 * Nunca confía en el navegador: el resultado siempre se consulta a la API del proveedor.
 * Es idempotente: aplicar dos veces el mismo resultado no vuelve a confirmar
 * el pedido ni a liberar stock.
 */
export class SyncPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly statusPort: PaymentStatusPort,
    private readonly processResult: PaymentResultProcessor,
  ) {}

  /** Consulta al proveedor un pago pendiente y aplica el resultado si ya es definitivo. */
  async syncPending(payment: Payment): Promise<void> {
    if (payment.status !== 'PENDING') {
      return;
    }

    const providerPayment = await this.statusPort.findPaymentByReference(payment);

    if (providerPayment) {
      // El cliente ya volvió del checkout: un rechazo es definitivo.
      await this.applyProviderPayment(payment, providerPayment, { applyRejection: true });
    }
  }

  /**
   * Revisa un pago que seguía pendiente cuando venció su pedido.
   * Si el cliente terminó de pagar justo después del vencimiento, el pago se reembolsa.
   * Los rechazos no se aplican: el pedido ya está vencido y el stock, liberado.
   */
  async reconcileExpired(payment: Payment): Promise<void> {
    if (payment.status !== 'PENDING') {
      return;
    }

    const providerPayment = await this.statusPort.findPaymentByReference(payment);

    if (providerPayment) {
      await this.applyProviderPayment(payment, providerPayment, { applyRejection: false });
    }
  }

  async applyProviderPayment(
    payment: Payment,
    providerPayment: ProviderPayment,
    options: { applyRejection: boolean },
  ): Promise<void> {
    if (payment.status !== 'PENDING' || providerPayment.status === 'PENDING') {
      return;
    }

    // En Checkout Pro el cliente puede reintentar con otra tarjeta después de un rechazo,
    // así que un aviso de rechazo no cancela el pedido mientras siga en el checkout.
    if (providerPayment.status === 'REJECTED' && !options.applyRejection) {
      return;
    }

    if (providerPayment.amountCents !== payment.amountCents) {
      console.error(
        `[Pagos] El monto informado por el proveedor no coincide con el pago ${payment.id}; no se aplica.`,
      );
      return;
    }

    // Se guarda el id del pago real: hace falta para un eventual reembolso.
    if (payment.providerPaymentId !== providerPayment.providerPaymentId) {
      await this.paymentRepository.updateProviderPaymentId(payment.id, providerPayment.providerPaymentId);
    }

    try {
      await this.processResult.execute(payment.id, providerPayment.status);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';

      if (ALREADY_APPLIED.has(code)) {
        return;
      }

      // Rechazo de un pedido que ya no estaba reservado (vencido o cancelado): no hay nada que hacer.
      if (providerPayment.status === 'REJECTED' && code === 'ORDER_NOT_RESERVED') {
        return;
      }

      if (code === 'LATE_PAYMENT_COMPENSATED') {
        console.warn(`[Pagos] Pago ${payment.id} aprobado después del vencimiento: se reembolsó.`);
        return;
      }

      if (LATE_APPROVAL.has(code)) {
        console.warn(`[Pagos] Aprobación tardía del pago ${payment.id}: el pedido no se confirma.`);
        return;
      }

      throw error;
    }
  }
}
