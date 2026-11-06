import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// These come from Vercel > Project > Settings > Environment Variables
// (or from the .env.local file when running on your own computer).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isConfigured = /^https:\/\/.+/.test(url) && key.length > 20;

let client: SupabaseClient | null = null;

/** One shared Supabase client for the whole app (browser only). */
export function getSupabase(): SupabaseClient {
  if (!isConfigured) throw new Error("Supabase is not configured");
  if (!client) client = createClient(url, key);
  return client;
}
