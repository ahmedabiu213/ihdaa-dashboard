import { z } from "zod";

const s = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

/** The ad touch the script remembers (last non-direct, 30 days). */
export const touchSchema = z.object({
  utm_source: s(100), utm_medium: s(100), utm_campaign: s(200), utm_content: s(200), utm_term: s(200), utm_id: s(100),
  click_type: z.enum(["sccid", "ttclid", "gclid", "gbraid", "wbraid", "fbclid"]).optional().nullable(),
  click_id: s(300),
  referrer: s(500),
  landing: s(500),
  ts: z.number().int().positive().optional().nullable(),
}).partial();

export const visitSchema = z.object({
  vid: z.string().min(4).max(64),
  sid: z.string().min(4).max(64),
  path: z.string().max(500),
  title: s(300),
  referrer: s(500),
  touch: touchSchema.optional().nullable(),
});

export const purchaseSchema = z.object({
  vid: z.string().min(4).max(64),
  sid: z.string().min(4).max(64),
  order_ref: z.string().trim().min(1).max(64),
  order_id: z.coerce.number().int().positive().optional().nullable(),
  reference_id: s(64),
  total: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  currency: s(8),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive().optional().nullable(),
    name: s(300),
    quantity: z.coerce.number().int().min(1).max(10_000).optional().nullable(),
    price: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  })).max(50).optional().nullable(),
  touch: touchSchema.optional().nullable(),
});

export type Touch = z.infer<typeof touchSchema>;
