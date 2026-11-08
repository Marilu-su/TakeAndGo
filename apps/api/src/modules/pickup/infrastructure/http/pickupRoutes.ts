
import { Router } from 'express';

import type { ActorResolver } from '../../../../shared/http/actorResolver';
import { requireActor } from '../../../../shared/http/requireActor';
import { DomainError } from '../../../../shared/domain/DomainError';

import type { PickupCredential } from '../../application/confirmPickupPort';
import type { PickupModule } from '../pickupModule';

type Dependencies = {
  pickupModule: PickupModule;
  resolveActor: ActorResolver;
};

function translatePickupError(error: unknown): never {
  if (error instanceof DomainError) {
    throw error;
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'ORDER_NOT_AVAILABLE_FOR_PICKUP':
      case 'ORDER_NOT_FOUND':
        throw new DomainError(
          'NOT_FOUND',
          'Pedido no encontrado o no disponible'
        );

      case 'ORDER_NOT_READY_FOR_PICKUP':
      case 'ORDER_PICKUP_CONFLICT':
      case 'STOCK_RESERVATION_CONFLICT':
        throw new DomainError(
          'PICKUP_CONFLICT',
          'El pedido no puede confirmarse en su estado actual'
        );

      case 'INVALID_PICKUP_CODE':
      case 'INVALID_OR_EXPIRED_PICKUP_TOKEN':
        throw new DomainError(
          'INVALID_PICKUP_CREDENTIAL',
          'La credencial de retiro es inválida o venció'
        );
    }
  }

  throw error;
}

export function createPickupRouter({
  pickupModule,
  resolveActor,
}: Dependencies): Router {
  const router = Router();

  // Cliente: emitir QR.
  router.post(
    '/orders/:orderId/pickup/qr',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);
      const { orderId } = req.params;

      if (!orderId?.trim()) {
        throw new DomainError(
          'INVALID_REQUEST',
          'Debe indicar el pedido'
        );
      }

      try {
        const result =
          await pickupModule.issuePickupTokenUseCase.execute(
            actor,
            orderId
          );

        res.setHeader('Cache-Control', 'no-store');
        res.status(201).json(result);
      } catch (error) {
        translatePickupError(error);
      }
    }
  );

  // Cliente: emitir código manual.
  router.post(
    '/orders/:orderId/pickup/manual',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);
      const { orderId } = req.params;

      try {
        const result =
          await pickupModule.manualPickupUseCase.issue(
            actor,
            orderId
          );

        res.setHeader('Cache-Control', 'no-store');
        res.status(201).json(result);
      } catch (error) {
        translatePickupError(error);
      }
    }
  );

  // Personal del buffet: buscar pedido por código.
  // POST evita incluir el código en la URL.
  router.post(
    '/stores/:storeId/pickup/by-code',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);
      const { storeId } = req.params;
      const code = req.body?.code;

      try {
        const result =
          await pickupModule.manualPickupUseCase.findByCode(
            actor,
            storeId,
            code
          );

        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(result);
      } catch (error) {
        translatePickupError(error);
      }
    }
  );

  // Personal del buffet: confirmar retiro por QR o código.
  router.post(
    '/stores/:storeId/pickup/orders/:orderId/confirm',
    async (req, res) => {
      const actor = await requireActor(resolveActor, req);

      const { storeId, orderId } = req.params;
      const credential = req.body?.credential;

      if (!storeId?.trim() || !orderId?.trim()) {
        throw new DomainError(
          'INVALID_REQUEST',
          'Debe indicar el buffet y el pedido'
        );
      }

      let pickupCredential: PickupCredential;

      if (
        credential?.type === 'QR' &&
        typeof credential.token === 'string' &&
        credential.token.trim()
      ) {
        pickupCredential = {
          type: 'QR',
          token: credential.token,
        };
      } else if (
        credential?.type === 'MANUAL' &&
        typeof credential.code === 'string' &&
        /^[A-Za-z0-9_-]{12}$/.test(credential.code)
      ) {
        pickupCredential = {
          type: 'MANUAL',
          code: credential.code,
        };
      } else {
        throw new DomainError(
          'INVALID_REQUEST',
          'Debe proporcionar una credencial de retiro válida'
        );
      }

      try {
        const result =
          await pickupModule.confirmPickupUseCase.execute(
            actor,
            storeId,
            orderId,
            pickupCredential
          );

        res.status(200).json(result);
      } catch (error) {
        translatePickupError(error);
      }
    }
  );

  return router;
}
