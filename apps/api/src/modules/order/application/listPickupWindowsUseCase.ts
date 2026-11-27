import {
  generateTodayPickupWindows,
  type StorePickupSchedule,
  type TemporalPickupWindow,
} from '../domain/pickupWindow';

export interface StorePickupScheduleSource {
  findByStoreId(storeId: string): Promise<StorePickupSchedule | null>;
}

export class ListPickupWindowsUseCase {
  constructor(
    private readonly schedules: StorePickupScheduleSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // BLOCKER: kitchen capacity is pending. These candidates establish temporal feasibility only.
  async execute(storeId: string): Promise<TemporalPickupWindow[]> {
    return (await this.getAvailability(storeId)).windows;
  }

  async getAvailability(storeId: string): Promise<{ requiresPickupWindow: boolean; windows: TemporalPickupWindow[] }> {
    const schedule = await this.schedules.findByStoreId(storeId);
    return {
      requiresPickupWindow: schedule !== null,
      windows: schedule ? generateTodayPickupWindows(this.now(), schedule) : [],
    };
  }
}
