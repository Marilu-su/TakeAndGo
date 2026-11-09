
import 'dotenv/config';

import app from './app';
import { PrismaOrderRepository } from './modules/order/infrastructure/prismaOrderRepository';
import { ActivatePickupWhenEligibleUseCase } from './modules/kitchen/application/activatePickupWhenEligibleUseCase';
import { ActivateEligiblePickupsUseCase } from './modules/kitchen/application/activateEligiblePickupsUseCase';

const PORT = process.env.PORT || 3001;

// Revisar los pedidos preparados cada 10 segundos.
const PICKUP_CHECK_INTERVAL_MS = 10_000;

const orderRepository = new PrismaOrderRepository();

const activatePickup = new ActivatePickupWhenEligibleUseCase(
  orderRepository
);

const activateEligiblePickups = new ActivateEligiblePickupsUseCase(
  orderRepository,
  activatePickup
);

// Evitar ejecuciones superpuestas dentro de este proceso.
let isProcessingPickups = false;

async function processEligiblePickups(): Promise<void> {
  if (isProcessingPickups) {
    return;
  }

  isProcessingPickups = true;

  try {
    const result = await activateEligiblePickups.execute();

    if (result.activatedOrdersCount > 0) {
      console.log(
        `[Cocina] Pedidos habilitados para retiro: ${result.activatedOrdersCount}`
      );
    }
  } catch (error) {
    console.error(
      '[Cocina] Error al activar pedidos para retiro:',
      error
    );
  } finally {
    isProcessingPickups = false;
  }
}

app.listen(PORT, () => {
  console.log(
    `Backend de Take&Go corriendo en http://localhost:${PORT}`
  );

  // Primera revisión al iniciar el backend.
  void processEligiblePickups();

  // Revisiones periódicas posteriores.
  setInterval(() => {
    void processEligiblePickups();
  }, PICKUP_CHECK_INTERVAL_MS);
});
