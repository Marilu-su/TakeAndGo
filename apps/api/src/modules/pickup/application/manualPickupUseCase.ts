
import type { Actor } from '../../../shared/auth/actor';
import { isStoreStaff } from '../../catalog/domain/catalogAuthorization';
import { DomainError } from '../../../shared/domain/DomainError';

export interface ManualPickupResult {
  orderId: string;
  storeId: string;
  orderNumber: number;
  code: string;
}

export interface ManualPickupLookup {
  orderId: string;
  storeId: string;
  orderNumber: number;
  status: 'READY_FOR_PICKUP';
}

export interface ManualPickupPort {
  issue(
    orderId: string,
    customerId: string
  ): Promise<ManualPickupResult>;

  findByCode(
    storeId: string,
    code: string
  ): Promise<ManualPickupLookup>;
}

export class ManualPickupUseCase {
  constructor(private readonly port: ManualPickupPort) {}

  async issue(
    actor: Actor,
    orderId: string
  ): Promise<ManualPickupResult> {
    if (!orderId?.trim()) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar el pedido'
      );
    }

    if (actor.role !== 'CUSTOMER') {
      throw new DomainError(
        'FORBIDDEN',
        'Solo el cliente puede solicitar su código'
      );
    }

    return this.port.issue(orderId, actor.userId);
  }

  async findByCode(
    actor: Actor,
    storeId: string,
    code: string
  ): Promise<ManualPickupLookup> {
    if (
      !storeId?.trim() ||
      typeof code !== 'string' ||
      !/^[A-Za-z0-9_-]{12}$/.test(code)
    ) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Código de retiro inválido'
      );
    }

    if (!isStoreStaff(actor, storeId)) {
      throw new DomainError(
        'FORBIDDEN',
        'No puede consultar retiros de este buffet'
      );
    }

    return this.port.findByCode(storeId, code);
  }
}
