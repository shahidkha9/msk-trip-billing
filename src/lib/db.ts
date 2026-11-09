import { getSupabase } from "./supabase";
import { migrateSettings, normalizeExpense, normalizeTrip } from "./defaults";
import { newId } from "./utils";
import type { Expense, Settings, Trip } from "./types";

const now = () => new Date().toISOString();

/** Reads every row of a table for this user (1000 at a time). */
async function readAll<T>(table: "trips" | "expenses", userId: string): Promise<{ id: string; data: Partial<T> }[]> {
  const sb = getSupabase();
  const rows: { id: string; data: Partial<T> }[] = [];
  for (let from = 0; ; from += 1000) {
    const q = await sb.from(table).select("id,data").eq("user_id", userId).order("id").range(from, from + 999);
    if (q.error) throw q.error;
    rows.push(...(q.data ?? []));
    if (!q.data || q.data.length < 1000) break;
  }
  return rows;
}

export interface Everything {
  settings: Settings;
  trips: Trip[];
  expenses: Expense[];
  /** false when the expenses table has not been created yet (run expenses-setup.sql) */
  expensesReady: boolean;
}

/** Loads all of the user's settings, trips and expenses from the cloud. */
export async function loadEverything(userId: string): Promise<Everything> {
  const sb = getSupabase();
  const s = await sb.from("settings").select("data").eq("user_id", userId).maybeSingle();
  if (s.error) throw s.error;

  const tripRows = await readAll<Trip>("trips", userId);

  // Expenses are loaded separately so the app still works before the new table exists.
  let expenses: Expense[] = [];
  let expensesReady = true;
  try {
    const expRows = await readAll<Expense>("expenses", userId);
    expenses = expRows.map((r) => normalizeExpense(r.id, r.data));
  } catch (e) {
    console.warn("Expenses not available:", e);
    expensesReady = false;
  }

  const { settings, changed } = migrateSettings(s.data?.data as Partial<Settings> | undefined);
  if (changed) await saveSettings(userId, settings);
  return { settings, trips: tripRows.map((r) => normalizeTrip(r.id, r.data)), expenses, expensesReady };
}

export async function saveSettings(userId: string, settings: Settings) {
  const { error } = await getSupabase().from("settings").upsert({ user_id: userId, data: settings, updated_at: now() });
  if (error) throw error;
}

/* ---------- trips ---------- */
export async function saveTrip(userId: string, trip: Trip) {
  const { id, ...data } = trip;
  const { error } = await getSupabase().from("trips").upsert({ id, user_id: userId, data, updated_at: now() });
  if (error) throw error;
}

export async function deleteTrip(id: string) {
  const { error } = await getSupabase().from("trips").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- expenses ---------- */
export async function saveExpense(userId: string, expense: Expense) {
  const { id, ...data } = expense;
  const { error } = await getSupabase().from("expenses").upsert({ id, user_id: userId, data, updated_at: now() });
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- bulk ---------- */
export async function deleteAllData(userId: string, includeExpenses: boolean) {
  const sb = getSupabase();
  const t = await sb.from("trips").delete().eq("user_id", userId);
  if (t.error) throw t.error;
  if (includeExpenses) {
    const e = await sb.from("expenses").delete().eq("user_id", userId);
    if (e.error) throw e.error;
  }
}

async function insertRows(table: "trips" | "expenses", rows: { id: string; user_id: string; data: unknown; updated_at: string }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await getSupabase().from(table).upsert(rows.slice(i, i + 500));
    if (r.error) throw r.error;
  }
}

/**
 * Replaces ALL online data with the contents of a backup file.
 * Expenses are replaced only if the backup contains them (older backups don't).
 */
export async function replaceAll(
  userId: string,
  settings: Settings,
  trips: Partial<Trip>[],
  expenses: Partial<Expense>[] | null,
  expensesReady: boolean,
) {
  const replaceExpenses = expensesReady && Array.isArray(expenses);
  await deleteAllData(userId, replaceExpenses);
  const stamp = now();
  await insertRows(
    "trips",
    trips.map((t) => {
      const { id, ...data } = normalizeTrip(t.id || newId(), t);
      return { id, user_id: userId, data, updated_at: stamp };
    }),
  );
  if (replaceExpenses) {
    await insertRows(
      "expenses",
      expenses!.map((x) => {
        const { id, ...data } = normalizeExpense(x.id || newId(), x);
        return { id, user_id: userId, data, updated_at: stamp };
      }),
    );
  }
  await saveSettings(userId, settings);
}

/** Turns any error into a short message a person can read. */
export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
