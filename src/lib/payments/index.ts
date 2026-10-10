import type { PaymentProvider } from "./types";
import { stripeProvider } from "./stripe";
import { mockProvider } from "./mock";

export function mockPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENTS_PROVIDER ?? (process.env.STRIPE_SECRET_KEY ? "stripe" : "mock")).toLowerCase();
  if (name === "stripe") return stripeProvider;
  if (name === "mock") {
    if (!mockPaymentsAllowed()) throw new Error("Test payments are disabled in production. Configure Stripe.");
    return mockProvider;
  }
  // Future: "square", "clover"
  throw new Error(`Unknown PAYMENTS_PROVIDER "${name}"`);
}

export function getProviderByName(name: string | null | undefined): PaymentProvider {
  if (name === "mock") return mockProvider;
  return stripeProvider;
}

export type { PaymentProvider } from "./types";
