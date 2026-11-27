import { CreatePaymentUseCase } from '../application/createPaymentUseCase';
import { ExpireReservationsJob, type ReleaseExpiredReservationsPort } from '../application/expireReservationsJob';
import { ProcessLatePaymentCompensationUseCase } from '../application/processLatePaymentCompensationUseCase';
import { GetPaymentStatusUseCase } from '../application/getPaymentStatusUseCase';
import { HandlePaymentNotificationUseCase } from '../application/handlePaymentNotificationUseCase';
import { ProcessPaymentResultUseCase } from '../application/processPaymentResultUseCase';
import { StartCheckoutUseCase } from '../application/startCheckoutUseCase';
import { SyncPaymentUseCase } from '../application/syncPaymentUseCase';
import { DomainError } from '../../../shared/domain/DomainError';
import type { OrderRepository } from '../../order/domain/orderRepository';
import type { PaymentPort } from '../domain/paymentPort';
import type { PaymentRefundPort } from '../domain/paymentRefundPort';
import type { PaymentStatusPort } from '../domain/paymentStatusPort';
import { FakeCheckoutPaymentPort } from './fakeCheckoutPaymentPort';
import { MercadoPagoPaymentPort } from './mercadoPagoPaymentPort';
import { PrismaPaymentCompensationRepository } from './prismaPaymentCompensationRepository';
import { PrismaPaymentOrderStockAdapter } from './prismaPaymentOrderStockAdapter';
import { PrismaPaymentRepository } from './prismaPaymentRepository';

export interface PaymentModule {
  startCheckout: StartCheckoutUseCase;
  getPaymentStatus: GetPaymentStatusUseCase;
  handleNotification: HandlePaymentNotificationUseCase;
  // Proceso periódico: vence reservas y reembolsa pagos tardíos (MVP-08).
  expireReservations: ExpireReservationsJob;
  // Clave para validar la firma de los avisos de Mercado Pago.
  webhookSecret?: string;
}

type Env = Record<string, string | undefined>;

export type PaymentProvider = PaymentPort & PaymentStatusPort & PaymentRefundPort;

const notConfigured = async (): Promise<never> => {
  throw new DomainError('PAYMENT_PROVIDER_ERROR', 'El proveedor de pagos no está configurado');
};

/** Elige el proveedor según PAYMENT_PROVIDER: "mercadopago" o "fake" (por defecto). */
export function createPaymentPort(env: Env = process.env): PaymentProvider {
  const provider = env.PAYMENT_PROVIDER ?? 'fake';
  const frontendUrl = env.FRONTEND_URL ?? env.CORS_ORIGIN ?? 'http://localhost:3000';

  if (provider === 'mercadopago') {
    return new MercadoPagoPaymentPort({
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
      frontendUrl,
      publicApiUrl: env.PUBLIC_API_URL,
      useSandboxUrl: env.MERCADOPAGO_SANDBOX !== 'false',
    });
  }

  if (provider === 'fake') {
    if (env.NODE_ENV === 'production') {
      // El simulador aprueba pagos sin cobrar: nunca en producción.
      return {
        createPaymentIntent: notConfigured,
        getPayment: notConfigured,
        findPaymentByReference: notConfigured,
        refundPayment: notConfigured,
      };
    }

    return new FakeCheckoutPaymentPort(frontendUrl);
  }

  throw new Error(`PAYMENT_PROVIDER inválido: "${provider}". Usá "mercadopago" o "fake".`);
}

export interface PaymentModuleDependencies {
  orderRepository: OrderRepository;
  releaseExpiredReservations: ReleaseExpiredReservationsPort;
}

export function createPaymentModule(
  { orderRepository, releaseExpiredReservations }: PaymentModuleDependencies,
  env: Env = process.env,
): PaymentModule {
  const paymentRepository = new PrismaPaymentRepository();
  const provider = createPaymentPort(env);
  const findOrder = (orderId: string) => orderRepository.findById(orderId);

  const createPayment = new CreatePaymentUseCase(paymentRepository, provider);
  // Una aprobación tardía no confirma el pedido: se reembolsa (MVP-08).
  const compensation = new ProcessLatePaymentCompensationUseCase(
    paymentRepository,
    orderRepository,
    new PrismaPaymentCompensationRepository(),
    provider,
  );
  const processResult = new ProcessPaymentResultUseCase(
    new PrismaPaymentOrderStockAdapter(),
    () => new Date(),
    compensation,
  );
  const sync = new SyncPaymentUseCase(paymentRepository, provider, processResult);

  return {
    startCheckout: new StartCheckoutUseCase(createPayment),
    getPaymentStatus: new GetPaymentStatusUseCase(paymentRepository, sync, findOrder),
    handleNotification: new HandlePaymentNotificationUseCase(provider, paymentRepository, sync),
    expireReservations: new ExpireReservationsJob(
      releaseExpiredReservations,
      (since, now) => paymentRepository.findPendingOfExpiredOrders(since, now),
      sync,
    ),
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || undefined,
  };
}
