import { CreatePaymentUseCase } from '../application/createPaymentUseCase';
import { GetPaymentStatusUseCase } from '../application/getPaymentStatusUseCase';
import { HandlePaymentNotificationUseCase } from '../application/handlePaymentNotificationUseCase';
import { ProcessPaymentResultUseCase } from '../application/processPaymentResultUseCase';
import { StartCheckoutUseCase } from '../application/startCheckoutUseCase';
import { SyncPaymentUseCase } from '../application/syncPaymentUseCase';
import { DomainError } from '../../../shared/domain/DomainError';
import type { Order } from '../../order/domain/order';
import type { PaymentPort } from '../domain/paymentPort';
import type { PaymentStatusPort } from '../domain/paymentStatusPort';
import { FakeCheckoutPaymentPort } from './fakeCheckoutPaymentPort';
import { MercadoPagoPaymentPort } from './mercadoPagoPaymentPort';
import { PrismaPaymentOrderStockAdapter } from './prismaPaymentOrderStockAdapter';
import { PrismaPaymentRepository } from './prismaPaymentRepository';

export interface PaymentModule {
  startCheckout: StartCheckoutUseCase;
  getPaymentStatus: GetPaymentStatusUseCase;
  handleNotification: HandlePaymentNotificationUseCase;
  // Clave para validar la firma de los avisos de Mercado Pago.
  webhookSecret?: string;
}

type Env = Record<string, string | undefined>;

export type PaymentProvider = PaymentPort & PaymentStatusPort;

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
      };
    }

    return new FakeCheckoutPaymentPort(frontendUrl);
  }

  throw new Error(`PAYMENT_PROVIDER inválido: "${provider}". Usá "mercadopago" o "fake".`);
}

export function createPaymentModule(
  findOrder: (orderId: string) => Promise<Order | null>,
  env: Env = process.env,
): PaymentModule {
  const paymentRepository = new PrismaPaymentRepository();
  const provider = createPaymentPort(env);

  const createPayment = new CreatePaymentUseCase(paymentRepository, provider);
  const processResult = new ProcessPaymentResultUseCase(new PrismaPaymentOrderStockAdapter());
  const sync = new SyncPaymentUseCase(paymentRepository, provider, processResult);

  return {
    startCheckout: new StartCheckoutUseCase(createPayment),
    getPaymentStatus: new GetPaymentStatusUseCase(paymentRepository, sync, findOrder),
    handleNotification: new HandlePaymentNotificationUseCase(provider, paymentRepository, sync),
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || undefined,
  };
}
