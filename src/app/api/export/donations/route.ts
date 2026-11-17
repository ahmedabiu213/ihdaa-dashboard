import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { isDatabaseConfigured } from "@/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { canSeeSpend } from "@/lib/roles";
import { channelLabel } from "@/lib/channels";
import { parseFilters } from "@/lib/queries/filters";
import { listDonations } from "@/lib/queries/donations";
import { donationFilters } from "@/lib/queries/donation-filters";

/** CSV of the donations list with the current filters (signed-in users only; also enforced by the proxy). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const staff = canSeeSpend(user.role);
  if (!isDatabaseConfigured()) return new Response("database not configured", { status: 503 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const f = donationFilters(sp, parseFilters(sp));
  const { rows } = await listDonations(f, 1, 50_000);
  const csv = Papa.unparse(rows.map((r) => ({
    order_number: r.reference ?? "", salla_id: r.sallaId ?? "", ordered_at: r.orderedAt, status: r.status ?? "",
    counted: r.countsAsRevenue ? "yes" : "no", amount_sar: r.total.toFixed(2), verified: r.verified ? "yes" : "no",
    source: r.source, channel: channelLabel(r.channel),
    ...(staff ? { campaign: r.campaign ?? r.utmCampaign ?? "" } : {}), project_code: r.utmTerm ?? "",
    projects: r.projects ?? "",
  })));
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donations-${f.range.from}-${f.range.to}.csv"`,
    },
  });
}
