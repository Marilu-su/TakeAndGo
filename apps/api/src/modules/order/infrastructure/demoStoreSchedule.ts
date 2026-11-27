import type { StorePickupScheduleSource } from '../application/listPickupWindowsUseCase';
import type { StorePickupSchedule } from '../domain/pickupWindow';
import type { StoreRepositoryPort } from '../../organization/application/ports';
import { createStoreCode } from '../../organization/domain/storeCode';

const DEMO_STORE_CODE = createStoreCode('SIS001');

const DEMO_SCHEDULE: StorePickupSchedule = {
  timeZone: 'America/Argentina/Buenos_Aires',
  opensAtMinute: 8 * 60,
  digitalClosesAtMinute: 21 * 60,
  operationalClosesAtMinute: 22 * 60,
};

export function createDemoStoreSchedule(demoStoreId: string): StorePickupScheduleSource {
  if (!demoStoreId.trim()) {
    throw new Error('Se requiere el ID del buffet de demo');
  }

  return {
    async findByStoreId(storeId) {
      return storeId === demoStoreId ? { ...DEMO_SCHEDULE } : null;
    },
  };
}

export function createResolvedDemoStoreSchedule(
  stores: Pick<StoreRepositoryPort, 'findByCode'>,
): StorePickupScheduleSource {
  return {
    async findByStoreId(storeId) {
      const demoStore = await stores.findByCode(DEMO_STORE_CODE);
      if (demoStore?.status !== 'ACTIVE') return null;
      return createDemoStoreSchedule(demoStore.id).findByStoreId(storeId);
    },
  };
}
