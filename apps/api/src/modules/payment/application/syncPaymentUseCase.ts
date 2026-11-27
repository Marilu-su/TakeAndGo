import type { Payment } from '../domain/payment';
import type { PaymentRepository } from '../domain/paymentRepository';
import type { PaymentStatusPort, ProviderPayment } from '../domain/paymentStatusPort';
import type { PaymentResult } from './processPaymentResultUseCase';

export interface PaymentResultProcessor {
  execute(paymentId: string, result: PaymentResult): Promise<Payment>;
}

// Otro aviso (o una consulta simultánea) ya aplicó el resultado: no es un error.
const ALREADY_APPLIED = new Set(['PAYMENT_STATE_CONFLICT', 'PAYMENT_ORDER_STATE_CONFLICT']);

// Aprobación después del vencimiento: no confirma el pedido (se resuelve en MVP-08).
const LATE_APPROVAL = new Set(['ORDER_NOT_RESERVED', 'PAYMENT_EXPIRED', 'LATE_PAYMENT_COMPENSATED']);

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

      if (LATE_APPROVAL.has(code)) {
        console.warn(`[Pagos] Aprobación tardía del pago ${payment.id}: el pedido no se confirma.`);
        return;
      }

      throw error;
    }
  }
}
