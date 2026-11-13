import { resolveRange, type DateRange } from "@/lib/dates";
import { isChannel, type Channel } from "@/lib/channels";

export type Filters = { range: DateRange; channel: Channel | null };
export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(sp: SearchParams): Filters {
  const channel = one(sp.channel);
  return {
    range: resolveRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) }),
    channel: isChannel(channel) ? channel : null,
  };
}
