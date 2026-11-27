import { DomainError } from '../../../shared/domain/DomainError';
import type { Order, OrderStatus } from '../../order/domain/order';
import type { Payment, PaymentStatus } from '../domain/payment';
import type { PaymentRepository } from '../domain/paymentRepository';
import type { SyncPaymentUseCase } from './syncPaymentUseCase';

export type CheckoutState = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface PaymentStatusResponse {
  paymentId: string;
  orderId: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  checkoutState: CheckoutState;
  amountCents: number;
  expiresAt: Date;
}

/** Estado que muestra la pantalla de checkout (contrato MVP-05). */
export function checkoutStateOf(
  paymentStatus: PaymentStatus,
  orderStatus: OrderStatus,
  expiresAt: Date,
  now: Date,
): CheckoutState {
  if (orderStatus === 'EXPIRED' || paymentStatus === 'REFUNDED') return 'EXPIRED';
  if (paymentStatus === 'REJECTED') return 'REJECTED';
  if (orderStatus === 'CANCELLED') return 'CANCELLED';
  if (paymentStatus === 'APPROVED') return 'CONFIRMED';
  if (now.getTime() >= expiresAt.getTime()) return 'EXPIRED';
  return 'PENDING';
}

/**
 * Contrato MVP-05, endpoint 2: estado del pago de un pedido.
 * Si el pago sigue pendiente, primero consulta al proveedor y aplica el resultado.
 */
export class GetPaymentStatusUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly sync: Pick<SyncPaymentUseCase, 'syncPending'>,
    private readonly findOrder: (orderId: string) => Promise<Order | null>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(order: Order): Promise<PaymentStatusResponse> {
    let payment: Payment | null = await this.paymentRepository.findByOrderId(order.id);

    if (!payment) {
      throw new DomainError('PAYMENT_NOT_FOUND', 'El pedido no tiene un pago iniciado');
    }

    let currentOrder = order;

    if (payment.status === 'PENDING') {
      try {
        await this.sync.syncPending(payment);
      } catch (error) {
        // Si el proveedor no responde, se informa el último estado conocido y la web reintenta.
        console.error('[Pagos] No se pudo consultar el pago al proveedor:', error);
      }

      payment = (await this.paymentRepository.findById(payment.id)) ?? payment;
      currentOrder = (await this.findOrder(order.id)) ?? order;
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      paymentStatus: payment.status,
      orderStatus: currentOrder.status,
      checkoutState: checkoutStateOf(payment.status, currentOrder.status, payment.expiresAt, this.now()),
      amountCents: payment.amountCents,
      expiresAt: payment.expiresAt,
    };
  }
}
