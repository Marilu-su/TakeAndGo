import type { Payment } from '../domain/payment';
import type { SyncPaymentUseCase } from './syncPaymentUseCase';

export interface ReleaseExpiredReservationsPort {
  execute(now: Date): Promise<{ releasedOrdersCount: number }>;
}

/** Pagos pendientes de pedidos vencidos entre `since` y `now`. */
export type FindPendingPaymentsOfExpiredOrders = (since: Date, now: Date) => Promise<Payment[]>;

// Durante cuánto tiempo después del vencimiento se sigue revisando si el pago se aprobó tarde.
export const LATE_PAYMENT_LOOKBACK_MS = 30 * 60 * 1000;

export interface ExpireReservationsResult {
  releasedOrdersCount: number;
  reviewedPaymentsCount: number;
}

/**
 * Proceso periódico (MVP-08):
 * 1. Vence los pedidos reservados que no se pagaron a tiempo y libera su stock.
 * 2. Revisa en el proveedor los pagos de pedidos recién vencidos: si alguno se aprobó tarde,
 *    no se confirma el pedido y se reembolsa. Así funciona aunque no llegue el aviso (por ejemplo, en local).
 */
export class ExpireReservationsJob {
  constructor(
    private readonly releaseExpired: ReleaseExpiredReservationsPort,
    private readonly findPendingPayments: FindPendingPaymentsOfExpiredOrders,
    private readonly sync: Pick<SyncPaymentUseCase, 'reconcileExpired'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(): Promise<ExpireReservationsResult> {
    const now = this.now();
    const { releasedOrdersCount } = await this.releaseExpired.execute(now);

    const payments = await this.findPendingPayments(new Date(now.getTime() - LATE_PAYMENT_LOOKBACK_MS), now);

    for (const payment of payments) {
      try {
        await this.sync.reconcileExpired(payment);
      } catch (error) {
        // Se reintenta en la próxima ejecución.
        console.error(`[Pagos] No se pudo revisar el pago vencido ${payment.id}:`, error);
      }
    }

    return { releasedOrdersCount, reviewedPaymentsCount: payments.length };
  }
}
