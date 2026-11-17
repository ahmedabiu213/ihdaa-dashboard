import type { ChannelRow, DailyPoint, Totals } from "./overview";
import type { ChannelDaily } from "./channels";

/**
 * Remove every spend figure before data leaves the server for a viewer account.
 * Hiding a column isn't enough: whatever a server component passes as props is
 * sent to the browser.
 */
export const redactTotals = (t: Totals): Totals => ({ ...t, spend: 0, platformValue: 0, roas: null, costPerDonation: null });
export const redactDaily = (d: DailyPoint[]): DailyPoint[] => d.map((p) => ({ ...p, spend: 0 }));
export const redactChannels = (rows: ChannelRow[]): ChannelRow[] =>
  rows.map((r) => ({ ...r, spend: 0, platformValue: 0 }))
    // A channel that only had spend (no visits or donations) isn't a donation channel.
    .filter((r) => r.visits > 0 || r.donations > 0 || r.revenue > 0);
export const redactChannelDaily = (rows: ChannelDaily[]): ChannelDaily[] =>
  rows.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, spend: 0 })) }))
    .filter((c) => c.points.some((p) => p.revenue > 0));
