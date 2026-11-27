import { DomainError } from '../../../shared/domain/DomainError';
import type { Order } from '../../order/domain/order';
import type { Payment } from '../domain/payment';

export type PayableOrder = Pick<Order, 'id' | 'status' | 'totalCents' | 'reservedUntil'>;

export interface CreatePaymentPort {
  execute(orderId: string, amountCents: number, expiresAt: Date): Promise<Payment>;
}

export interface CheckoutResponse {
  paymentId: string;
  orderId: string;
  status: Payment['status'];
  amountCents: number;
  expiresAt: Date;
  checkoutUrl: string;
}

/**
 * Inicia el pago de un pedido reservado (contrato MVP-05, endpoint 1).
 * El monto es el total del pedido y el pago vence junto con la reserva.
 * Repetir la solicitud devuelve el mismo pago y el mismo link.
 */
export class StartCheckoutUseCase {
  constructor(
    private readonly createPayment: CreatePaymentPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(order: PayableOrder): Promise<CheckoutResponse> {
    if (order.status !== 'RESERVED') {
      throw new DomainError('ORDER_NOT_PAYABLE', 'El pedido no está pendiente de pago');
    }

    if (!order.reservedUntil || order.reservedUntil.getTime() <= this.now().getTime()) {
      throw new DomainError('RESERVATION_EXPIRED', 'Se venció el tiempo para pagar el pedido');
    }

    let payment: Payment;

    try {
      payment = await this.createPayment.execute(order.id, order.totalCents, order.reservedUntil);
    } catch (error) {
      if (error instanceof Error && error.message === 'PAYMENT_REQUEST_CONFLICT') {
        throw new DomainError('ORDER_NOT_PAYABLE', 'El pago del pedido no coincide con la reserva actual');
      }

      throw error;
    }

    if (payment.status !== 'PENDING' || !payment.checkoutUrl) {
      throw new DomainError('ORDER_NOT_PAYABLE', 'El pedido no está pendiente de pago');
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amountCents: payment.amountCents,
      expiresAt: payment.expiresAt,
      checkoutUrl: payment.checkoutUrl,
    };
  }
}
