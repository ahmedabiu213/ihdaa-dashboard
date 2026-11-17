/**
 * Who can see what. Shared by the proxy, server pages and client components,
 * so it imports nothing server-only.
 *
 * - admin:  everything, including user management
 * - member: the marketing team, everything except user management
 * - viewer: donations only: totals, channels, projects and the donations log.
 *           No ad spend, ROAS, campaigns, tools or settings.
 */
export const ROLES = ["admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "مسؤول",
  member: "عضو",
  viewer: "عارض التبرعات",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "مسؤول: كل اللوحة وإدارة المستخدمين",
  member: "عضو: كل اللوحة بما فيها الإنفاق والأدوات",
  viewer: "عارض التبرعات: التبرعات والقنوات والمشاريع فقط، بدون الإنفاق",
};

/** Unknown or missing roles fall back to member, as before viewer existed. */
export function roleOf(value: unknown): Role {
  return value === "admin" || value === "viewer" ? value : "member";
}

export const canSeeSpend = (role: Role) => role !== "viewer";

/** Pages and APIs a viewer may open. Everything else is redirected (pages) or refused (APIs). */
const VIEWER_PATHS = ["/", "/channels", "/projects", "/donations", "/account", "/api/export/donations"];

export function canOpen(role: Role, pathname: string) {
  if (role !== "viewer") return true;
  return VIEWER_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}
