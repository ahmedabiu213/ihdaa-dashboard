import { canOpen, canSeeSpend, roleOf } from "./roles";

let failed = 0;
const check = (name: string, ok: boolean) => { if (!ok) { failed++; console.error("FAIL", name); } else console.log("ok  ", name); };

check("unknown role is member", roleOf(undefined) === "member" && roleOf("x") === "member");
check("viewer parsed", roleOf("viewer") === "viewer" && roleOf("admin") === "admin");
check("viewer sees no spend", !canSeeSpend("viewer") && canSeeSpend("member") && canSeeSpend("admin"));
for (const p of ["/", "/channels", "/projects", "/donations", "/account", "/api/export/donations"]) check(`viewer may open ${p}`, canOpen("viewer", p));
for (const p of ["/campaigns", "/spend", "/utm", "/settings", "/users", "/api/oauth/snapchat/start", "/channelsx", "/donations-admin"]) check(`viewer blocked from ${p}`, !canOpen("viewer", p));
for (const p of ["/campaigns", "/spend", "/settings"]) check(`member may open ${p}`, canOpen("member", p));
process.exit(failed ? 1 : 0);
