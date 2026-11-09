
import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { isStoreStaff } from '../../catalog/domain/catalogAuthorization';

import type {
  ConfirmPickupPort,
  ConfirmPickupResult,
  PickupCredential,
} from './confirmPickupPort';

export class ConfirmPickupUseCase {
  constructor(
    private readonly pickupPort: ConfirmPickupPort,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(
    actor: Actor,
    storeId: string,
    orderId: string,
    credential: PickupCredential
  ): Promise<ConfirmPickupResult> {
    // Validar los identificadores obligatorios.
    if (!storeId?.trim() || !orderId?.trim()) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar el buffet y el pedido'
      );
    }

    // Solo el personal del buffet puede confirmar retiros.
    if (!isStoreStaff(actor, storeId)) {
      throw new DomainError(
        'FORBIDDEN',
        'No tiene permisos para confirmar retiros en este buffet'
      );
    }

    // El retiro debe tener una credencial.
    if (
      !credential ||
      (credential.type !== 'QR' &&
        credential.type !== 'MANUAL')
    ) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar una credencial de retiro válida'
      );
    }

    if (
      (credential.type === 'QR' &&
        !credential.token?.trim()) ||
      (credential.type === 'MANUAL' &&
        !credential.code?.trim())
    ) {
      throw new DomainError(
        'INVALID_REQUEST',
        'La credencial de retiro no puede estar vacía'
      );
    }

    // La validación definitiva de estado, credencial
    // y stock se realizará dentro de la transacción.
    return this.pickupPort.confirm({
      storeId,
      orderId,
      employeeUserId: actor.userId,
      credential,
      now: this.now(),
    });
  }
}
