"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import { cloneSettings, DEFAULT_SETTINGS, migrateSettings, normalizeTrip } from "@/lib/defaults";
import type { Settings, Trip } from "@/lib/types";
import { rs, fmtDate, tripTotal } from "@/lib/utils";
import { Button, Card, Field } from "./ui";
import { EntryTab } from "./EntryTab";
import { RecordsTab } from "./RecordsTab";
import { SettingsTab } from "./SettingsTab";
import { BackupTab, LAST_BACKUP_KEY } from "./BackupTab";
import type { AppApi } from "./types";

type Screen = "starting" | "setup" | "login" | "app";
type Tab = "entry" | "records" | "settings" | "backup";
const CACHE_KEY = "msk_cache_v2";

const TABS: { id: Tab; label: string }[] = [
  { id: "entry", label: "➕ New Entry" },
  { id: "records", label: "📋 Records & Bills" },
  { id: "settings", label: "⚙️ Rates & Locations" },
  { id: "backup", label: "💾 Backup" },
];

export default function TripBillingApp() {
  const [screen, setScreen] = useState<Screen>("starting");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<Settings>(() => cloneSettings(DEFAULT_SETTINGS));
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tab, setTab] = useState<Tab>("entry");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; kind: "info" | "ok" | "bad" }>({ text: "Loading…", kind: "info" });
  const [toastMsg, setToastMsg] = useState("");
  const [needsBackup, setNeedsBackup] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  /* ---------- offline copy (read-only when there is no internet) ---------- */
  const writeCache = useCallback((uid: string, s: Settings, t: Trip[]) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, settings: s, trips: t, at: Date.now() })); } catch { /* ignore */ }
  }, []);

  /* ---------- load from the cloud ---------- */
  const loadAll = useCallback(async (uid: string, quiet = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!quiet) setStatus({ text: "Loading data…", kind: "info" });
    try {
      const data = await db.loadEverything(uid);
      setSettings(data.settings);
      setTrips(data.trips);
      writeCache(uid, data.settings, data.trips);
      const time = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
      const n = data.trips.length;
      setStatus({ text: `✔ Synced ${time} — ${n} ${n === 1 ? "entry" : "entries"}`, kind: "ok" });
    } catch (e) {
      console.error(e);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (c && c.uid === uid) {
          setSettings(migrateSettings(c.settings).settings);
          setTrips((c.trips as Trip[]).map((t) => normalizeTrip(t.id, t)));
        }
      } catch { /* ignore */ }
      setStatus({ text: "⚠ No connection — showing last saved copy. New entries need internet. Tap ⟳ Sync to retry.", kind: "bad" });
    } finally {
      loadingRef.current = false;
    }
  }, [writeCache]);

  /* ---------- start up: check login ---------- */
  useEffect(() => {
    if (!isConfigured) { setScreen("setup"); return; }
    const sb = getSupabase();
    const enter = (session: Session | null) => {
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email ?? "");
        setScreen("app");
      } else {
        setUserId(null);
        setScreen("login");
      }
    };
    sb.auth.getSession().then(({ data }) => enter(data.session)).catch(() => setScreen("login"));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") enter(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId, loadAll]);

  // Refresh automatically when you come back to the app (e.g. after using the phone).
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => { if (document.visibilityState === "visible") loadAll(userId, true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, loadAll]);

  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0;
      setNeedsBackup(trips.length >= 20 && Date.now() - last > 30 * 864e5);
    } catch { setNeedsBackup(false); }
  }, [trips.length, tab]);

  /* ---------- actions that save to the cloud ---------- */
  const api: AppApi = {
    settings,
    trips,
    toast,
    reload: async () => { if (userId) await loadAll(userId); },
    saveTrip: async (trip) => {
      if (!userId) return false;
      try {
        await db.saveTrip(userId, trip);
        setTrips((prev) => {
          const next = prev.some((t) => t.id === trip.id) ? prev.map((t) => (t.id === trip.id ? trip : t)) : [...prev, trip];
          writeCache(userId, settings, next);
          return next;
        });
        return true;
      } catch (e) {
        alert("Could not save the entry (check your internet). Nothing was saved.\n" + db.errMsg(e));
        return false;
      }
    },
    removeTrip: async (id) => {
      if (!userId) return false;
      try {
        await db.deleteTrip(id);
        setTrips((prev) => prev.filter((t) => t.id !== id));
        return true;
      } catch (e) {
        alert("Could not delete (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
    updateSettings: async (next) => {
      if (!userId) return false;
      try {
        await db.saveSettings(userId, next);
        setSettings(next);
        writeCache(userId, next, trips);
        return true;
      } catch (e) {
        alert("Could not save settings (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
    replaceAll: async (s, t) => {
      if (!userId) return false;
      setStatus({ text: "Restoring backup… please wait", kind: "info" });
      try {
        await db.replaceAll(userId, s, t);
        return true;
      } catch (e) {
        alert("Restore failed (check your internet) — please try again.\n" + db.errMsg(e));
        return false;
      } finally {
        await loadAll(userId);
      }
    },
    wipeTrips: async () => {
      if (!userId) return false;
      try {
        await db.deleteAllTrips(userId);
        setTrips([]);
        writeCache(userId, settings, []);
        return true;
      } catch (e) {
        alert("Could not delete (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
  };

  const askDelete = async (id: string) => {
    const t = trips.find((x) => x.id === id);
    if (!t) return;
    if (!confirm(`Delete this entry?\n${fmtDate(t.date)}  ${t.vehicleNo}  ${t.from} → ${t.to}  ${rs(tripTotal(t))}`)) return;
    if (await api.removeTrip(id)) {
      if (editingId === id) setEditingId(null);
      toast("Entry deleted");
    }
  };
  const startEdit = (id: string) => { setEditingId(id); setTab("entry"); };

  const logout = async () => {
    if (!confirm("Log out from this device?")) return;
    try { await getSupabase().auth.signOut(); } catch { /* ignore */ }
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    setTrips([]);
    setSettings(cloneSettings(DEFAULT_SETTINGS));
    setUserId(null);
    setScreen("login");
  };

  /* ---------- screens ---------- */
  if (screen === "starting") {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }
  if (screen === "setup") return <SetupScreen />;
  if (screen === "login") return <LoginScreen />;

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2.5 bg-brand px-4 py-3.5 text-white print:hidden">
        <div>
          <h1 className="text-xl font-bold">{settings.businessName || "MSK Transport Service"}</h1>
          <p className="text-[13px] opacity-85">Trip records — quick entry, automatic fare, PDF bills</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="opacity-90">{email}</span>
          <button className="cursor-pointer rounded-md border border-white/40 bg-white/15 px-2.5 py-1.5" onClick={() => userId && loadAll(userId)}>
            ⟳ Sync
          </button>
          <button className="cursor-pointer rounded-md border border-white/40 bg-white/15 px-2.5 py-1.5" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      <div
        className={`border-b border-line px-4 py-1.5 text-[13px] print:hidden ${
          status.kind === "ok" ? "bg-[#e8f6f0] text-ok" : status.kind === "bad" ? "bg-[#fdecea] text-bad" : "bg-soft text-brand"
        }`}
      >
        {status.text}
      </div>

      <nav className="sticky top-0 z-10 flex flex-wrap gap-1.5 border-b border-line bg-white px-4 py-2.5 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm ${
              tab === t.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-[1200px] p-4 print:max-w-none print:p-0">
        {needsBackup && tab === "entry" && (
          <div className="mb-3 rounded-lg border border-[#f5d38a] bg-[#fff7e6] px-3 py-2.5 text-sm text-[#7a4b00] print:hidden">
            💾 Tip: download a backup file for extra safety.{" "}
            <button className="cursor-pointer underline" onClick={() => setTab("backup")}>Go to Backup</button>
          </div>
        )}
        {tab === "entry" && <EntryTab api={api} editingId={editingId} setEditingId={setEditingId} onDelete={askDelete} />}
        {tab === "records" && <RecordsTab api={api} onEdit={startEdit} onDelete={askDelete} />}
        {tab === "settings" && <SettingsTab api={api} />}
        {tab === "backup" && <BackupTab api={api} />}
      </main>

      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-white shadow-lg print:hidden">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ---------- login screen ---------- */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "Wrong email or password." : "Login failed: " + error.message);
      } else {
        window.location.reload();
      }
    } catch {
      setError("No connection. Check your internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card>
          <h1 className="text-[22px] font-bold text-brand">MSK Transport Service</h1>
          <p className="mb-4 text-[13px] text-muted">Trip Billing — please log in</p>
          <div className="mb-3">
            <Field label="Email">
              <input type="email" required autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="mb-4">
            <Field label="Password">
              <input type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log In"}</Button>
          <p className="mt-2 min-h-5 text-sm text-bad">{error}</p>
        </Card>
      </form>
    </div>
  );
}

/* ---------- shown when the database keys are missing ---------- */
function SetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-2 text-[22px] font-bold text-brand">Setup needed</h1>
          <p className="mb-2">The database connection is not configured yet.</p>
          <p className="text-[13px] text-muted">
            In Vercel, open your project → <b>Settings → Environment Variables</b> and add{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. Then go to{" "}
            <b>Deployments</b> and click <b>Redeploy</b>. (See SETUP-GUIDE.md, Step 4.)
          </p>
        </Card>
      </div>
    </div>
  );
}
