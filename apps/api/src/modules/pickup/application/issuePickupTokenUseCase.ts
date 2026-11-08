
import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';

import type {
  IssuePickupTokenPort,
  IssuedPickupToken,
} from './issuePickupTokenPort';

export class IssuePickupTokenUseCase {
  constructor(
    private readonly tokenPort: IssuePickupTokenPort,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(
    actor: Actor,
    orderId: string
  ): Promise<IssuedPickupToken> {
    if (!orderId?.trim()) {
      throw new DomainError(
        'INVALID_REQUEST',
        'Debe indicar el pedido'
      );
    }

    if (actor.role !== 'CUSTOMER') {
      throw new DomainError(
        'FORBIDDEN',
        'Solo el cliente puede solicitar el QR de retiro'
      );
    }

    return this.tokenPort.issue({
      orderId,
      customerId: actor.userId,
      now: this.now(),
    });
  }
}
