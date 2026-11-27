import type { StorePickupScheduleSource } from '../application/listPickupWindowsUseCase';
import type { StorePickupSchedule } from '../domain/pickupWindow';
import type { PrismaStoreRepository } from '../../organization/infrastructure/prismaStoreRepository';
import { createStoreCode } from '../../organization/domain/storeCode';

const DEMO_STORE_CODE = createStoreCode('SIS001');

export const DEMO_SCHEDULE: StorePickupSchedule = {
  timeZone: 'America/Argentina/Buenos_Aires',
  opensAtMinute: 8 * 60,
  digitalClosesAtMinute: 21 * 60 + 30,
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
  stores: Pick<PrismaStoreRepository, 'findPickupScheduleByCode'>,
): StorePickupScheduleSource {
  return {
    async findByStoreId(storeId) {
      const demoStore = await stores.findPickupScheduleByCode(DEMO_STORE_CODE);
      if (demoStore?.id !== storeId || demoStore.status !== 'ACTIVE') return null;
      return demoStore.pickupSchedule;
    },
  };
}
