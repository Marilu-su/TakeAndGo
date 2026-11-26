import { CreatePaymentUseCase } from '../application/createPaymentUseCase';
import { StartCheckoutUseCase } from '../application/startCheckoutUseCase';
import { DomainError } from '../../../shared/domain/DomainError';
import type { PaymentPort } from '../domain/paymentPort';
import { FakeCheckoutPaymentPort } from './fakeCheckoutPaymentPort';
import { MercadoPagoPaymentPort } from './mercadoPagoPaymentPort';
import { PrismaPaymentRepository } from './prismaPaymentRepository';

export interface PaymentModule {
  startCheckout: StartCheckoutUseCase;
}

type Env = Record<string, string | undefined>;

/** Elige el proveedor según PAYMENT_PROVIDER: "mercadopago" o "fake" (por defecto). */
export function createPaymentPort(env: Env = process.env): PaymentPort {
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
        createPaymentIntent: async () => {
          throw new DomainError('PAYMENT_PROVIDER_ERROR', 'El proveedor de pagos no está configurado');
        },
      };
    }

    return new FakeCheckoutPaymentPort(frontendUrl);
  }

  throw new Error(`PAYMENT_PROVIDER inválido: "${provider}". Usá "mercadopago" o "fake".`);
}

export function createPaymentModule(env: Env = process.env): PaymentModule {
  const paymentRepository = new PrismaPaymentRepository();
  const createPayment = new CreatePaymentUseCase(paymentRepository, createPaymentPort(env));

  return {
    startCheckout: new StartCheckoutUseCase(createPayment),
  };
}
