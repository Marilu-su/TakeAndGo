import type { PaymentRepository } from '../domain/paymentRepository';
import type { PaymentStatusPort } from '../domain/paymentStatusPort';
import type { SyncPaymentUseCase } from './syncPaymentUseCase';

/**
 * Contrato MVP-05, endpoint 3: aviso del proveedor (webhook).
 * El aviso solo trae el id del pago: el resultado se consulta a la API del proveedor,
 * así un aviso falso no puede confirmar un pedido.
 */
export class HandlePaymentNotificationUseCase {
  constructor(
    private readonly statusPort: PaymentStatusPort,
    private readonly paymentRepository: PaymentRepository,
    private readonly sync: Pick<SyncPaymentUseCase, 'applyProviderPayment'>,
  ) {}

  async execute(providerPaymentId: string): Promise<void> {
    const providerPayment = await this.statusPort.getPayment(providerPaymentId);

    if (!providerPayment?.externalReference) {
      return;
    }

    const payment = await this.paymentRepository.findById(providerPayment.externalReference);

    if (!payment) {
      return;
    }

    await this.sync.applyProviderPayment(payment, providerPayment, { applyRejection: false });
  }
}
