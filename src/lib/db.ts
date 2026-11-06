import { getSupabase } from "./supabase";
import { migrateSettings, normalizeTrip } from "./defaults";
import { newId } from "./utils";
import type { Settings, Trip } from "./types";

const now = () => new Date().toISOString();

/** Loads all of the user's settings and trips from the cloud. */
export async function loadEverything(userId: string): Promise<{ settings: Settings; trips: Trip[] }> {
  const sb = getSupabase();
  const s = await sb.from("settings").select("data").eq("user_id", userId).maybeSingle();
  if (s.error) throw s.error;

  const rows: { id: string; data: Partial<Trip> }[] = [];
  for (let from = 0; ; from += 1000) {
    const q = await sb.from("trips").select("id,data").eq("user_id", userId).order("id").range(from, from + 999);
    if (q.error) throw q.error;
    rows.push(...(q.data ?? []));
    if (!q.data || q.data.length < 1000) break;
  }

  const { settings, changed } = migrateSettings(s.data?.data as Partial<Settings> | undefined);
  if (changed) await saveSettings(userId, settings);
  return { settings, trips: rows.map((r) => normalizeTrip(r.id, r.data)) };
}

export async function saveSettings(userId: string, settings: Settings) {
  const { error } = await getSupabase().from("settings").upsert({ user_id: userId, data: settings, updated_at: now() });
  if (error) throw error;
}

export async function saveTrip(userId: string, trip: Trip) {
  const { id, ...data } = trip;
  const { error } = await getSupabase().from("trips").upsert({ id, user_id: userId, data, updated_at: now() });
  if (error) throw error;
}

export async function deleteTrip(id: string) {
  const { error } = await getSupabase().from("trips").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllTrips(userId: string) {
  const { error } = await getSupabase().from("trips").delete().eq("user_id", userId);
  if (error) throw error;
}

/** Replaces ALL online data with the contents of a backup file. */
export async function replaceAll(userId: string, settings: Settings, trips: Partial<Trip>[]) {
  await deleteAllTrips(userId);
  const rows = trips.map((t) => {
    const n = normalizeTrip(t.id || newId(), t);
    const { id, ...data } = n;
    return { id, user_id: userId, data, updated_at: now() };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const r = await getSupabase().from("trips").upsert(rows.slice(i, i + 500));
    if (r.error) throw r.error;
  }
  await saveSettings(userId, settings);
}

/** Turns any error into a short message a person can read. */
export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
