
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
  /**
   * True when this confirmation returns an existing pickup without another delivery.
   * Replays still return HTTP 200. Whether #109 requires an HTTP rejection for
   * reuse in addition to rejecting a second physical delivery is pending team agreement.
   */
  alreadyPickedUp: boolean;
}

export interface ConfirmPickupPort {
  confirm(input: ConfirmPickupInput): Promise<ConfirmPickupResult>;
}
