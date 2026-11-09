import type { Profile } from "./types";
import { daysBetween } from "./utils";

export type AccessKind = "admin" | "trial" | "paid" | "expired" | "suspended" | "unknown";

export interface Access {
  kind: AccessKind;
  /** may add / change data (the database enforces the same rule) */
  canWrite: boolean;
  /** days left in the trial or paid period */
  daysLeft: number;
  /** end of the current trial or paid period */
  until: string | null;
}

/** Works out what this account is allowed to do right now. */
export function accessOf(p: Profile | null, at?: Date): Access {
  if (!p) return { kind: "unknown", canWrite: true, daysLeft: 0, until: null };
  // Read the clock only when there is an account (never while the page is being pre-built).
  const now = at ?? new Date();
  if (p.isAdmin) return { kind: "admin", canWrite: true, daysLeft: 0, until: null };
  if (p.status === "suspended") return { kind: "suspended", canWrite: false, daysLeft: 0, until: null };
  const paid = p.paidUntil ? new Date(p.paidUntil) : null;
  const trial = p.trialEndsAt ? new Date(p.trialEndsAt) : null;
  if (paid && paid > now) return { kind: "paid", canWrite: true, daysLeft: daysBetween(now, paid), until: p.paidUntil };
  if (trial && trial > now) return { kind: "trial", canWrite: true, daysLeft: daysBetween(now, trial), until: p.trialEndsAt };
  return { kind: "expired", canWrite: false, daysLeft: 0, until: p.paidUntil || p.trialEndsAt };
}
