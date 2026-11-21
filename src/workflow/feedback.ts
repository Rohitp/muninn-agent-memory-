import { redact } from "../privacy/redact.js";
import type { Moment } from "../learn/signals.js";
import type { Session } from "../logs/types.js";
import { buildRuns, REVIEWER, type Run } from "./runs.js";

/**
 * Agents correcting agents. In a guided session you send work back with "no, …"; in a team of agents a reviewer,
 * checker or qa role does it, and a builder's "follow-up" fixes are what it missed the first time. Each role that had
 * work sent back, or fixed its own earlier work, at least twice becomes a moment, with the role it's for.
 */
export const FEEDBACK_MIN = 2;
export function feedbackMoments(repo: string, sessions: Session[], runs: Run[] = buildRuns(repo, sessions)): (Moment & { role: string })[] {
  const byRole = new Map<string, { quotes: Moment["quotes"]; from: Set<string>; runs: Set<string>; last: string }>();
  for (const r of runs) for (const h of r.handoffs) {
    if (h.kind !== "review_rejected" && h.kind !== "rework") continue;
    // A send-back is a lesson for the role it went to; a follow-up fix, for the role that made it.
    const role = h.kind === "rework" ? h.from_role : h.to_role;
    if (!role || role === "everyone" || role === "board" || role.includes(",")) continue;
    const g = byRole.get(role) ?? { quotes: [], from: new Set<string>(), runs: new Set<string>(), last: "" };
    g.quotes.push({ tool: r.sessions[0]?.tool ?? "claude-code", session: r.id, ts: h.at, quote: redact(`${h.kind === "rework" ? `${role} fixed later` : `${h.from_role} sent back`}: ${h.note ?? ""}`).slice(0, 240) });
    g.from.add(h.from_role); g.runs.add(r.id); if (h.at > g.last) g.last = h.at;
    byRole.set(role, g);
  }
  // Work fixed after it was approved: the roles that check work (reviewer, checker, qa) let it through.
  // The builder's lesson is above; this one is for the gates, which approved and sent nothing back.
  const gates = new Map<string, { quotes: Moment["quotes"]; runs: Set<string>; last: string; approvals: number }>();
  for (const r of runs) {
    const fixes = r.handoffs.filter((h) => h.kind === "rework");
    if (!fixes.length) continue;
    for (const role of r.roles.filter((x) => REVIEWER.test(x))) {
      const approvals = r.handoffs.filter((h) => h.kind === "approved" && h.from_role === role).length;
      const sentBack = r.handoffs.filter((h) => h.kind === "review_rejected" && h.from_role === role).length;
      if (!approvals || sentBack >= fixes.length) continue;
      const g = gates.get(role) ?? { quotes: [], runs: new Set<string>(), last: "", approvals: 0 };
      for (const h of fixes) { g.quotes.push({ tool: r.sessions[0]?.tool ?? "claude-code", session: r.id, ts: h.at, quote: redact(`fixed after ${role} approved: ${h.note ?? ""}`).slice(0, 240) }); if (h.at > g.last) g.last = h.at; }
      g.runs.add(r.id); g.approvals += approvals;
      gates.set(role, g);
    }
  }
  const out: (Moment & { role: string })[] = [];
  for (const [role, g] of gates) {
    if (g.quotes.length < FEEDBACK_MIN) continue;
    out.push({
      signal: "missed", role,
      text: redact(`The ${role} role approved ${g.approvals} time(s), but ${g.quotes.length} fix(es) were still needed after its approval`),
      quotes: g.quotes.slice(-8), sessions: g.runs.size, days: 1, wordings: g.quotes.length, tools: [...new Set(g.quotes.map((q) => q.tool))], last: g.last,
      context: `The role these lessons are for: ${role}, which checks other agents' work. Each quote is a fix made after it approved. Lesson: what it should check before approving.`,
    });
  }
  for (const [role, g] of byRole) {
    if (g.quotes.length < FEEDBACK_MIN) continue;
    out.push({
      signal: "sent_back", role,
      text: redact(`Work by the ${role} role was sent back or fixed later ${g.quotes.length} times, by ${[...g.from].join(", ")}`),
      quotes: g.quotes.slice(-8), sessions: g.runs.size, days: 1, wordings: g.quotes.length, tools: [...new Set(g.quotes.map((q) => q.tool))], last: g.last,
      context: `The role these lessons are for: ${role}. Each quote is what another agent said when sending its work back, or the ${role}'s own note on a later fix.`,
    });
  }
  return out;
}
