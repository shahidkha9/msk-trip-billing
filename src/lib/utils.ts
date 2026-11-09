import type { Trip } from "./types";

export const num = (n: number | string | undefined) => Math.round(Number(n) || 0).toLocaleString("en-PK");
export const rs = (n: number | string | undefined) => "Rs " + num(n);
export const up = (s: string | undefined) => String(s ?? "").trim().toUpperCase();

/** Date -> "YYYY-MM-DD" in the user's local time zone. */
export function isoLocal(d: Date): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
export const today = () => isoLocal(new Date());
/** "2026-10-30" -> "30/10/2026" */
export const fmtDate = (d: string | undefined) => (d ? d.split("-").reverse().join("/") : "");

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const loadOf = (t: Trip) => (t.loading ? Number(t.loadAmt) || 0 : 0);
export const detentionOf = (t: Trip) => (t.detention ? Number(t.detentionAmt) || 0 : 0);
export const tripTotal = (t: Trip) => (Number(t.rent) || 0) + loadOf(t) + detentionOf(t) + (Number(t.extra) || 0);

export interface Sums {
  n: number;
  rent: number;
  load: number;
  loadN: number;
  detention: number;
  detentionN: number;
  extra: number;
  total: number;
}
export function sums(list: Trip[]): Sums {
  const s: Sums = { n: list.length, rent: 0, load: 0, loadN: 0, detention: 0, detentionN: 0, extra: 0, total: 0 };
  for (const t of list) {
    s.rent += Number(t.rent) || 0;
    s.load += loadOf(t);
    if (t.loading) s.loadN++;
    s.detention += detentionOf(t);
    if (t.detention) s.detentionN++;
    s.extra += Number(t.extra) || 0;
    s.total += tripTotal(t);
  }
  return s;
}

export const sortTrips = (list: Trip[]) =>
  [...list].sort((a, b) => (a.date === b.date ? (a.created || 0) - (b.created || 0) : a.date < b.date ? -1 : 1));

/**
 * Formats a Karachi vehicle number as you type: "kmzr711" -> "KMZR-711".
 * With final=true the number part is padded: "KMZR-711" -> "KMZR-0711".
 * Up to 4 letters and 4 digits.
 */
export function formatVehicleNo(v: string, final = false): string {
  const clean = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = clean.match(/^([A-Z]{0,4})(\d*)(.*)$/);
  if (!m) return clean;
  const letters = m[1];
  let digits = (m[2] + m[3].replace(/\D/g, "")).slice(0, 4);
  if (final && letters && digits) digits = digits.padStart(4, "0");
  return digits ? `${letters}-${digits}` : letters;
}

/** YTM-01 / YTM-07 are the base; the route comes from the other party. */
export const isBase = (name: string) => /^YTM/i.test(String(name).trim());
export function otherParty(from: string, to: string): string {
  const f = up(from), t = up(to);
  if (t && !isBase(t)) return t;
  if (f && !isBase(f)) return f;
  return t || f;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function periodText(list: Trip[], from: string, to: string) {
  const f = from || list[0]?.date || "";
  const t = to || list[list.length - 1]?.date || "";
  return `${fmtDate(f)} to ${fmtDate(t)}`;
}

export function billNo() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `B-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/* ---------- outside (hired) vehicles ---------- */
/** What you owe the outside vehicle for this trip (0 for your own vehicle). */
export const hiredCostOf = (t: Trip) => (t.hired ? Number(t.hiredCost) || 0 : 0);
/** Your margin on this trip: what the customer pays minus what you pay the outside vehicle. */
export const tripMargin = (t: Trip) => tripTotal(t) - hiredCostOf(t);

/* ---------- date ranges ---------- */
export type RangePreset = "thismonth" | "lastmonth" | "week" | "all";
/** Returns [from, to] as YYYY-MM-DD ("" = no limit). */
export function rangeFor(r: RangePreset): [string, string] {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  if (r === "thismonth") return [isoLocal(new Date(y, m, 1)), isoLocal(new Date(y, m + 1, 0))];
  if (r === "lastmonth") return [isoLocal(new Date(y, m - 1, 1)), isoLocal(new Date(y, m, 0))];
  if (r === "week") return [isoLocal(new Date(y, m, d.getDate() - 6)), today()];
  return ["", ""];
}
export const inRange = (date: string, from: string, to: string) => (!from || date >= from) && (!to || date <= to);
