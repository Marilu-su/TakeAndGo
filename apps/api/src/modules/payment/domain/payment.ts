
export type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUNDED';

export interface Payment {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amountCents: number;
  expiresAt: Date;
  providerPaymentId?: string | null;
  // Checkout Pro: preferencia creada en el proveedor y link al que se redirige al cliente.
  providerPreferenceId?: string | null;
  checkoutUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function canTransitionPayment(
  currentStatus: PaymentStatus,
  newStatus: PaymentStatus,
): boolean {
  switch (currentStatus) {
    case 'PENDING':
      return newStatus === 'APPROVED' ||
             newStatus === 'REJECTED';

    case 'APPROVED':
      return newStatus === 'REFUNDED';

    case 'REJECTED':
    case 'REFUNDED':
      return false;
  }
}
