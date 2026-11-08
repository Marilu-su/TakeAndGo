
export interface IssuePickupTokenInput {
  orderId: string;
  customerId: string;
  now: Date;
}

export interface IssuedPickupToken {
  token: string;
  expiresAt: Date;
}

export interface IssuePickupTokenPort {
  issue(input: IssuePickupTokenInput): Promise<IssuedPickupToken>;
}
