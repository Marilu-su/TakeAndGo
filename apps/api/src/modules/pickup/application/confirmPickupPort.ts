
export type PickupCredential =
  | {
      type: 'QR';
      token: string;
    }
  | {
      type: 'MANUAL';
      code: string;
    };

export interface ConfirmPickupInput {
  storeId: string;
  orderId: string;
  employeeUserId: string;
  credential: PickupCredential;
  now: Date;
}

export interface ConfirmPickupResult {
  orderId: string;
  storeId: string;
  status: 'COMPLETED';
  pickedUpAt: Date;
}

export interface ConfirmPickupPort {
  confirm(input: ConfirmPickupInput): Promise<ConfirmPickupResult>;
}
