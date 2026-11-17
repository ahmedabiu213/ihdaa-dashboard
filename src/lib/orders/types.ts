export type OrderSource = "browser" | "make" | "salla_webhook" | "import";

/** Salla's own data is trusted; the storefront script is not. */
export const VERIFIED_SOURCES: readonly OrderSource[] = ["make", "salla_webhook", "import"];

export type NormalizedItem = {
  productId: number | null;
  name: string;
  sku: string | null;
  quantity: number;
  totalSar: number;
};

export type NormalizedOrder = {
  sallaId: number | null;
  referenceId: string | null;
  status: string | null;
  totalSar: number;
  currency: string;
  paymentMethod: string | null;
  orderedAt: Date;
  items: NormalizedItem[];
  source: OrderSource;
  raw: unknown;
  /** False for partial events (status change, delete) that carry no amount: never overwrite money with 0. */
  hasAmount?: boolean;
};

/**
 * Salla status slugs that are NOT money in the bank. Everything else
 * (under_review, in_progress, completed, delivered, …) counts.
 * Confirm against real orders once the first verified ones arrive.
 */
export const NON_REVENUE_STATUSES = new Set([
  "payment_pending", "pending", "awaiting_payment",
  "canceled", "cancelled", "restoring", "restored", "refunded", "failed",
  "deleted", "request_quote", // seen in this store's status list
]);

export function countsAsRevenue(status: string | null) {
  return status == null || !NON_REVENUE_STATUSES.has(status.toLowerCase());
}
