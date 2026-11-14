import type { Filters, SearchParams } from "./filters";
import type { DonationListFilters } from "./donations";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function donationFilters(sp: SearchParams, base: Filters): DonationListFilters {
  const status = one(sp.status);
  const verified = one(sp.verified);
  return {
    ...base,
    q: one(sp.q)?.trim().slice(0, 80) || null,
    status: status === "paid" || status === "unpaid" ? status : "all",
    verified: verified === "yes" || verified === "no" ? verified : "all",
  };
}
