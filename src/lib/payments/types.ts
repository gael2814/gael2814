/**
 * Payment provider abstraction. Stripe is implemented today; Square or Clover
 * can be added by implementing this interface and selecting it with the
 * PAYMENTS_PROVIDER environment variable.
 */
export type CheckoutLine = { name: string; unitCents: number; quantity: number; description?: string };

export type CheckoutRequest = {
  orderId: string;
  orderNumber: number;
  lines: CheckoutLine[];
  taxCents: number;
  taxLabel: string;
  customerEmail: string;
  pickupLabel: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
};

export type CheckoutSession = { sessionId: string; url: string };

export type SessionStatus = {
  paid: boolean;
  expired: boolean;
  paymentIntentId: string | null;
  orderId: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  getSessionStatus(sessionId: string): Promise<SessionStatus>;
  expireSession(sessionId: string): Promise<void>;
  refund(args: { paymentIntentId: string; amountCents: number; idempotencyKey: string }): Promise<{ refundId: string }>;
}
