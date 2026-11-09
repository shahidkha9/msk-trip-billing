"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isConfigured } from "@/lib/supabase";
import * as db from "@/lib/db";
import { accessOf } from "@/lib/access";
import { PAYMENT_METHODS, PRICE_TEXT, PRODUCT_NAME, SUPPORT_PHONE } from "@/lib/brand";
import { cloneSettings, DEFAULT_SETTINGS, migrateSettings, normalizers } from "@/lib/defaults";
import type { Customer, Expense, Profile, Receipt, Settings, TableMap, TableName, Trip, Vehicle } from "@/lib/types";
import { fmtDate, fmtDateTime, rs, tripTotal } from "@/lib/utils";
import { Card } from "./ui";
import { AuthScreens, ResetPasswordScreen, UpgradeScreen } from "./AuthScreens";
import { SetupWizard } from "./SetupWizard";
import { EntryTab } from "./EntryTab";
import { RecordsTab } from "./RecordsTab";
import { CustomersTab } from "./CustomersTab";
import { FleetTab } from "./FleetTab";
import { ExpensesTab } from "./ExpensesTab";
import { PaymentsTab } from "./PaymentsTab";
import { ReportsTab } from "./ReportsTab";
import { SettingsTab } from "./SettingsTab";
import { BackupTab, LAST_BACKUP_KEY } from "./BackupTab";
import { AdminTab } from "./AdminTab";
import type { AppApi } from "./types";

type Screen = "starting" | "config" | "auth" | "reset" | "upgrade" | "wizard" | "app";
type Tab = "entry" | "records" | "customers" | "fleet" | "expenses" | "payments" | "reports" | "settings" | "backup" | "admin";
const CACHE_KEY = "tl_cache_v4";

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "entry", label: "➕ New Trip" },
  { id: "records", label: "📋 Trips & Bills" },
  { id: "customers", label: "🏢 Customers" },
  { id: "fleet", label: "🚚 Fleet & Drivers" },
  { id: "expenses", label: "💸 Expenses" },
  { id: "payments", label: "🤝 Owner Payments" },
  { id: "reports", label: "📊 Reports" },
  { id: "settings", label: "⚙️ Settings" },
  { id: "backup", label: "💾 Backup" },
  { id: "admin", label: "👑 Admin", adminOnly: true },
];

type Data = { trips: Trip[]; expenses: Expense[]; customers: Customer[]; vehicles: Vehicle[]; receipts: Receipt[] };
const EMPTY: Data = { trips: [], expenses: [], customers: [], vehicles: [], receipts: [] };

export default function TripBillingApp() {
  const [screen, setScreen] = useState<Screen>("starting");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<Settings>(() => cloneSettings(DEFAULT_SETTINGS));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [tab, setTab] = useState<Tab>("entry");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; kind: "info" | "ok" | "bad" }>({ text: "Loading…", kind: "info" });
  const [toastMsg, setToastMsg] = useState("");
  const [needsBackup, setNeedsBackup] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const dataRef = useRef<{ settings: Settings; data: Data }>({ settings, data: EMPTY });

  const access = useMemo(() => accessOf(profile), [profile]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  /* ---------- offline copy (read-only when there is no internet) ---------- */
  const writeCache = useCallback((uid: string) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, ...dataRef.current, at: Date.now() })); } catch { /* ignore */ }
  }, []);
  const setAll = useCallback((uid: string, s: Settings, d: Data) => {
    dataRef.current = { settings: s, data: d };
    setSettings(s);
    setData(d);
    writeCache(uid);
  }, [writeCache]);

  /* ---------- load from the cloud ---------- */
  const loadAll = useCallback(async (uid: string, quiet = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!quiet) setStatus({ text: "Loading data…", kind: "info" });
    try {
      const r = await db.loadEverything(uid);
      if (r.upgradeNeeded) { setScreen("upgrade"); return; }
      setProfile(r.profile);
      setAll(uid, r.settings, { trips: r.trips, expenses: r.expenses, customers: r.customers, vehicles: r.vehicles, receipts: r.receipts });
      const time = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
      setStatus({ text: `✔ Synced ${time}`, kind: "ok" });
      setScreen(r.settings.setupDone ? "app" : "wizard");
    } catch (e) {
      console.error(e);
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (c && c.uid === uid && c.data) {
          const d = {} as Data;
          for (const t of db.TABLES) {
            const norm = normalizers[t] as (id: string, x: unknown) => TableMap[typeof t];
            (d as Record<string, unknown>)[t] = ((c.data[t] ?? []) as { id: string }[]).map((x) => norm(x.id, x));
          }
          dataRef.current = { settings: migrateSettings(c.settings).settings, data: d };
          setSettings(dataRef.current.settings);
          setData(d);
          setScreen("app");
        }
      } catch { /* ignore */ }
      setStatus({ text: "⚠ No connection — showing last saved copy. Saving needs internet. Tap ⟳ Sync to retry.", kind: "bad" });
    } finally {
      loadingRef.current = false;
    }
  }, [setAll]);

  /* ---------- start up: check login ---------- */
  useEffect(() => {
    if (!isConfigured) { setScreen("config"); return; }
    // A password-reset link opens the app with "type=recovery" in the address.
    const recovering = typeof window !== "undefined" && /type=recovery/.test(window.location.hash);
    const sb = getSupabase();
    const enter = (session: Session | null) => {
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email ?? "");
        if (recovering) setScreen("reset");
      } else {
        setUserId(null);
        setScreen("auth");
      }
    };
    sb.auth.getSession().then(({ data }) => enter(data.session)).catch(() => setScreen("auth"));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { if (session?.user) setUserId(session.user.id); setScreen("reset"); }
      if (event === "SIGNED_OUT") enter(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId && screen !== "reset") loadAll(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Refresh when you come back to the app (e.g. after using it on the phone).
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => { if (document.visibilityState === "visible" && screen === "app") loadAll(userId, true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, loadAll, screen]);

  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0;
      setNeedsBackup(data.trips.length >= 20 && Date.now() - last > 30 * 864e5);
    } catch { setNeedsBackup(false); }
  }, [data.trips.length, tab]);

  /* ---------- actions that save to the cloud ---------- */
  const readOnlyMsg = `Your ${access.kind === "suspended" ? "account is suspended" : "free trial / subscription has ended"}. ` +
    `You can still view and download your data. To continue adding entries, pay ${PRICE_TEXT} (${PAYMENT_METHODS}) and contact ${SUPPORT_PHONE}.`;

  const guard = () => {
    if (!access.canWrite) { alert(readOnlyMsg); return false; }
    return !!userId;
  };

  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);

  const api: AppApi = {
    settings, profile, access, ...data, toast,
    customerName: (id) => customerMap.get(id) ?? "",
    reload: async () => { if (userId) await loadAll(userId); },
    save: async <K extends TableName>(table: K, item: TableMap[K]) => {
      if (!guard()) return false;
      try {
        await db.saveItem(table, userId!, item);
        const list = dataRef.current.data[table] as TableMap[K][];
        const next = list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
        dataRef.current = { ...dataRef.current, data: { ...dataRef.current.data, [table]: next } };
        setData(dataRef.current.data);
        writeCache(userId!);
        return true;
      } catch (e) {
        alert("Could not save (check your internet). Nothing was saved.\n" + db.errMsg(e));
        return false;
      }
    },
    remove: async (table, id) => {
      if (!guard()) return false;
      try {
        await db.deleteItem(table, id);
        const list = dataRef.current.data[table] as { id: string }[];
        dataRef.current = { ...dataRef.current, data: { ...dataRef.current.data, [table]: list.filter((x) => x.id !== id) } };
        setData(dataRef.current.data);
        writeCache(userId!);
        return true;
      } catch (e) {
        alert("Could not delete (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
    updateSettings: async (next) => {
      if (!guard()) return false;
      try {
        await db.saveSettings(userId!, next);
        dataRef.current = { ...dataRef.current, settings: next };
        setSettings(next);
        writeCache(userId!);
        return true;
      } catch (e) {
        alert("Could not save settings (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
    replaceAll: async (b) => {
      if (!guard()) return false;
      setStatus({ text: "Restoring backup… please wait", kind: "info" });
      try {
        await db.replaceAll(userId!, b);
        return true;
      } catch (e) {
        alert("Restore failed — please try again.\n" + db.errMsg(e));
        return false;
      } finally {
        await loadAll(userId!);
      }
    },
    wipeAll: async () => {
      if (!guard()) return false;
      try {
        await db.deleteAllData(userId!);
        setAll(userId!, dataRef.current.settings, EMPTY);
        return true;
      } catch (e) {
        alert("Could not delete (check your internet).\n" + db.errMsg(e));
        return false;
      }
    },
  };

  const askDeleteTrip = async (id: string) => {
    const t = data.trips.find((x) => x.id === id);
    if (!t) return;
    if (!confirm(`Delete this trip?\n${fmtDate(t.date)}  ${t.vehicleNo}  ${t.from} → ${t.to}  ${rs(tripTotal(t))}`)) return;
    if (await api.remove("trips", id)) {
      if (editingId === id) setEditingId(null);
      toast("Trip deleted");
    }
  };
  const startEdit = (id: string) => { setEditingId(id); setTab("entry"); };

  const logout = async () => {
    try { await getSupabase().auth.signOut(); } catch { /* ignore */ }
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    dataRef.current = { settings: cloneSettings(DEFAULT_SETTINGS), data: EMPTY };
    setData(EMPTY);
    setSettings(cloneSettings(DEFAULT_SETTINGS));
    setProfile(null);
    setUserId(null);
    setTab("entry");
    setScreen("auth");
  };

  const finishWizard = async (s: Settings, c: Customer | null) => {
    if (!userId) return false;
    try {
      if (c) await db.saveItem("customers", userId, c);
      await db.saveSettings(userId, s);
      setAll(userId, s, { ...dataRef.current.data, customers: c ? [...dataRef.current.data.customers, c] : dataRef.current.data.customers });
      setScreen("app");
      toast("Setup complete ✔ — add your first trip!");
      return true;
    } catch (e) {
      alert("Could not save setup.\n" + db.errMsg(e));
      return false;
    }
  };

  /* ---------- screens ---------- */
  if (screen === "starting") return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  if (screen === "config") return <ConfigScreen />;
  if (screen === "auth") return <AuthScreens onLoggedIn={() => window.location.reload()} />;
  if (screen === "reset")
    return <ResetPasswordScreen onDone={() => { window.history.replaceState(null, "", "/"); window.location.reload(); }} />;
  if (screen === "upgrade") return <UpgradeScreen onRetry={() => userId && loadAll(userId)} onLogout={logout} />;
  if (screen === "wizard") return <SetupWizard profile={profile} onFinish={finishWizard} />;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || profile?.isAdmin);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2.5 bg-brand px-4 py-3 text-white print:hidden">
        <div>
          <h1 className="text-xl font-bold">{settings.businessName || PRODUCT_NAME}</h1>
          <p className="text-[12px] opacity-80">{PRODUCT_NAME}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="opacity-90">{email}</span>
          <button className="cursor-pointer rounded-md border border-white/40 bg-white/15 px-2.5 py-1.5" onClick={() => userId && loadAll(userId)}>⟳ Sync</button>
          <button className="cursor-pointer rounded-md border border-white/40 bg-white/15 px-2.5 py-1.5"
            onClick={() => { if (confirm("Log out from this device?")) logout(); }}>Log Out</button>
        </div>
      </header>

      <SubscriptionBanner access={access} />

      <div className={`border-b border-line px-4 py-1.5 text-[13px] print:hidden ${
        status.kind === "ok" ? "bg-[#e8f6f0] text-ok" : status.kind === "bad" ? "bg-[#fdecea] text-bad" : "bg-soft text-brand"}`}>
        {status.text}
        {status.kind === "ok" && ` — ${data.trips.length} ${data.trips.length === 1 ? "trip" : "trips"}`}
      </div>

      <nav className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-line bg-white px-4 py-2.5 print:hidden">
        {visibleTabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg border px-3 py-2 text-sm ${
              tab === t.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-[1250px] p-4 print:max-w-none print:p-0">
        {needsBackup && tab === "entry" && (
          <div className="mb-3 rounded-lg border border-[#f5d38a] bg-[#fff7e6] px-3 py-2.5 text-sm text-[#7a4b00] print:hidden">
            💾 Tip: download a backup file for extra safety.{" "}
            <button className="cursor-pointer underline" onClick={() => setTab("backup")}>Go to Backup</button>
          </div>
        )}
        {tab === "entry" && <EntryTab api={api} editingId={editingId} setEditingId={setEditingId} onDelete={askDeleteTrip} />}
        {tab === "records" && <RecordsTab api={api} onEdit={startEdit} onDelete={askDeleteTrip} />}
        {tab === "customers" && <CustomersTab api={api} />}
        {tab === "fleet" && <FleetTab api={api} />}
        {tab === "expenses" && <ExpensesTab api={api} />}
        {tab === "payments" && <PaymentsTab api={api} onEditTrip={startEdit} />}
        {tab === "reports" && <ReportsTab api={api} />}
        {tab === "settings" && <SettingsTab api={api} />}
        {tab === "backup" && <BackupTab api={api} />}
        {tab === "admin" && profile?.isAdmin && <AdminTab api={api} />}
      </main>

      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-white shadow-lg print:hidden">{toastMsg}</div>
      )}
    </div>
  );
}

/* ---------- trial / subscription banner ---------- */
function SubscriptionBanner({ access }: { access: ReturnType<typeof accessOf> }) {
  if (access.kind === "admin" || access.kind === "unknown") return null;
  if (access.kind === "paid" && access.daysLeft > 5) return null;
  const pay = `Pay ${PRICE_TEXT} via ${PAYMENT_METHODS} and send the receipt to ${SUPPORT_PHONE}.`;
  let cls = "bg-[#fff7e6] text-[#7a4b00] border-[#f5d38a]";
  let text: string;
  if (access.kind === "trial") {
    text = `🎁 Free trial: ${access.daysLeft} ${access.daysLeft === 1 ? "day" : "days"} left (until ${fmtDateTime(access.until)}). ${pay}`;
    if (access.daysLeft > 7) cls = "bg-soft text-brand border-line";
  } else if (access.kind === "paid") {
    text = `Your subscription ends in ${access.daysLeft} ${access.daysLeft === 1 ? "day" : "days"} (${fmtDateTime(access.until)}). ${pay}`;
  } else {
    cls = "bg-[#fdecea] text-bad border-[#f3b8b2]";
    text = access.kind === "suspended"
      ? `⛔ Your account is suspended. You can view and download your data. Contact ${SUPPORT_PHONE}.`
      : `⛔ Your ${access.until ? "subscription ended on " + fmtDateTime(access.until) : "trial has ended"}. You can view and download your data, but cannot add or change entries. ${pay}`;
  }
  return <div className={`border-b px-4 py-2 text-[13px] print:hidden ${cls}`}>{text}</div>;
}

/* ---------- shown when the database keys are missing ---------- */
function ConfigScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card title="Setup needed">
          <p className="mb-2">The database connection is not configured yet.</p>
          <p className="mb-2 text-[13px] text-muted">
            Add your Supabase <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>:
          </p>
          <ul className="list-disc pl-5 text-[13px] text-muted">
            <li className="mb-1"><b>On Vercel:</b> Project → Settings → Environment Variables, then Deployments → Redeploy.</li>
            <li><b>On your computer:</b> put them in <code>.env.local</code>, save, stop the server (Ctrl + C) and run <code>npm run dev</code> again.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
