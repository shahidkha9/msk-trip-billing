import { getSupabase } from "./supabase";
import { migrateSettings, normalizers } from "./defaults";
import { newId } from "./utils";
import type { AdminUser, Customer, Expense, Profile, Receipt, Settings, TableMap, TableName, Trip, Vehicle } from "./types";

const now = () => new Date().toISOString();
export const TABLES: TableName[] = ["trips", "expenses", "customers", "vehicles", "receipts"];

/** True when the error means "this table / function does not exist yet" (database not upgraded). */
export function isMissing(e: unknown): boolean {
  const x = e as { code?: string; message?: string } | null;
  return !!x && (x.code === "PGRST205" || x.code === "PGRST202" || x.code === "42P01" || x.code === "42883" ||
    /could not find the (table|function)|does not exist/i.test(x.message ?? ""));
}

/** Turns any error into a short message a person can read. */
export function errMsg(e: unknown): string {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied/i.test(m)) return "Your account cannot save right now (trial or subscription ended).";
  return m;
}

/* ---------- generic table access ---------- */
async function readAll<K extends TableName>(table: K, userId: string): Promise<TableMap[K][]> {
  const sb = getSupabase();
  const out: TableMap[K][] = [];
  for (let from = 0; ; from += 1000) {
    const q = await sb.from(table).select("id,data").eq("user_id", userId).order("id").range(from, from + 999);
    if (q.error) throw q.error;
    for (const r of q.data ?? []) out.push((normalizers[table] as (id: string, d: unknown) => TableMap[K])(r.id, r.data));
    if (!q.data || q.data.length < 1000) break;
  }
  return out;
}

export async function saveItem<K extends TableName>(table: K, userId: string, item: TableMap[K]) {
  const { id, ...data } = item;
  const { error } = await getSupabase().from(table).upsert({ id, user_id: userId, data, updated_at: now() });
  if (error) throw error;
}

export async function deleteItem(table: TableName, id: string) {
  const { error } = await getSupabase().from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function saveSettings(userId: string, settings: Settings) {
  const { error } = await getSupabase().from("settings").upsert({ user_id: userId, data: settings, updated_at: now() });
  if (error) throw error;
}

/* ---------- profile / subscription ---------- */
type ProfileRow = {
  user_id: string; email: string | null; business_name: string | null; phone: string | null; status: string;
  is_admin: boolean; trial_ends_at: string | null; paid_until: string | null; admin_note: string | null; created_at: string;
};
const toProfile = (r: ProfileRow): Profile => ({
  userId: r.user_id, email: r.email ?? "", businessName: r.business_name ?? "", phone: r.phone ?? "",
  status: r.status === "suspended" ? "suspended" : "active", isAdmin: !!r.is_admin,
  trialEndsAt: r.trial_ends_at, paidUntil: r.paid_until, adminNote: r.admin_note ?? "", createdAt: r.created_at,
});

/* ---------- load everything ---------- */
export interface Everything {
  settings: Settings;
  profile: Profile | null;
  trips: Trip[];
  expenses: Expense[];
  customers: Customer[];
  vehicles: Vehicle[];
  receipts: Receipt[];
  /** the database still needs supabase-setup.sql (new tables / profiles missing) */
  upgradeNeeded: boolean;
}

export async function loadEverything(userId: string): Promise<Everything> {
  const sb = getSupabase();
  const empty = { trips: [], expenses: [], customers: [], vehicles: [], receipts: [] };

  const p = await sb.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (p.error) {
    if (isMissing(p.error)) return { settings: migrateSettings(null).settings, profile: null, ...empty, upgradeNeeded: true };
    throw p.error;
  }
  const s = await sb.from("settings").select("data").eq("user_id", userId).maybeSingle();
  if (s.error) throw s.error;

  let data: Pick<Everything, TableName>;
  try {
    const [trips, expenses, customers, vehicles, receipts] = await Promise.all(TABLES.map((t) => readAll(t, userId)));
    data = {
      trips: trips as Trip[], expenses: expenses as Expense[], customers: customers as Customer[],
      vehicles: vehicles as Vehicle[], receipts: receipts as Receipt[],
    };
  } catch (e) {
    if (isMissing(e)) return { settings: migrateSettings(null).settings, profile: null, ...empty, upgradeNeeded: true };
    throw e;
  }

  const raw = s.data?.data as Partial<Settings> | undefined;
  const { settings, changed } = migrateSettings(raw);
  let save = changed && !!raw;

  // Older versions had one "Bill To" company. Turn it into a customer, once.
  if (!settings.defaultCustomerId && settings.billTo.trim() && data.trips.some((t) => !t.customerId)) {
    const existing = data.customers.find((c) => c.name.trim().toLowerCase() === settings.billTo.trim().toLowerCase());
    const c: Customer = existing ?? { id: newId(), name: settings.billTo.trim(), phone: "", address: "", notes: "", created: Date.now() };
    if (!existing) { await saveItem("customers", userId, c); data.customers.push(c); }
    settings.defaultCustomerId = c.id;
    save = true;
  }
  if (save) await saveSettings(userId, settings);
  // Trips saved before customers existed belong to the default customer.
  if (settings.defaultCustomerId) {
    for (const t of data.trips) if (!t.customerId) t.customerId = settings.defaultCustomerId;
  }

  return { settings, profile: p.data ? toProfile(p.data as ProfileRow) : null, ...data, upgradeNeeded: false };
}

/* ---------- bulk ---------- */
export async function deleteAllData(userId: string) {
  const sb = getSupabase();
  for (const t of TABLES) {
    const r = await sb.from(t).delete().eq("user_id", userId);
    if (r.error) throw r.error;
  }
}

export interface BackupData {
  settings: Settings;
  trips: Partial<Trip>[];
  expenses?: Partial<Expense>[];
  customers?: Partial<Customer>[];
  vehicles?: Partial<Vehicle>[];
  receipts?: Partial<Receipt>[];
}

/** Replaces online data with a backup. Tables missing from an older backup are left as they are. */
export async function replaceAll(userId: string, b: BackupData) {
  const sb = getSupabase();
  const stamp = now();
  for (const t of TABLES) {
    const list = b[t] as Partial<TableMap[typeof t]>[] | undefined;
    if (!Array.isArray(list)) continue;
    const del = await sb.from(t).delete().eq("user_id", userId);
    if (del.error) throw del.error;
    const rows = list.map((x) => {
      const item = (normalizers[t] as (id: string, d: unknown) => TableMap[typeof t])(x.id || newId(), x);
      const { id, ...data } = item;
      return { id, user_id: userId, data, updated_at: stamp };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const r = await sb.from(t).upsert(rows.slice(i, i + 500));
      if (r.error) throw r.error;
    }
  }
  await saveSettings(userId, b.settings);
}

/* ---------- admin ---------- */
type AdminRow = ProfileRow & { trip_count: number; last_activity: string | null };

export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await getSupabase().rpc("admin_list_users");
  if (error) throw error;
  return ((data ?? []) as AdminRow[]).map((r) => ({ ...toProfile(r), tripCount: Number(r.trip_count) || 0, lastActivity: r.last_activity }));
}

export async function adminUpdateUser(u: Pick<Profile, "userId" | "status" | "trialEndsAt" | "paidUntil" | "adminNote">) {
  const { error } = await getSupabase().rpc("admin_update_user", {
    p_target: u.userId, p_status: u.status, p_trial_ends: u.trialEndsAt, p_paid_until: u.paidUntil, p_note: u.adminNote,
  });
  if (error) throw error;
}
