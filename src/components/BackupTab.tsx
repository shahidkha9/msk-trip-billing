"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { migrateSettings } from "@/lib/defaults";
import type { BackupData } from "@/lib/db";
import { TABLES } from "@/lib/db";
import type { Settings, Trip } from "@/lib/types";
import { downloadBlob, today } from "@/lib/utils";
import { Button, Card } from "./ui";
import type { AppApi } from "./types";

export const LAST_BACKUP_KEY = "msk_lastbackup";

export function BackupTab({ api }: { api: AppApi }) {
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setLast(Number(localStorage.getItem(LAST_BACKUP_KEY)) || null); } catch { /* storage blocked */ }
  }, []);

  const download = () => {
    const data = {
      app: "tripbill", version: 5, savedAt: new Date().toISOString(), settings: api.settings,
      trips: api.trips, expenses: api.expenses, customers: api.customers, vehicles: api.vehicles, receipts: api.receipts,
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), `MSK_Backup_${today()}.json`);
    const now = Date.now();
    try { localStorage.setItem(LAST_BACKUP_KEY, String(now)); } catch { /* ignore */ }
    setLast(now);
    api.toast("Backup downloaded ✔");
  };

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let d: Omit<BackupData, "settings" | "trips"> & { app?: string; settings?: Partial<Settings>; trips?: Partial<Trip>[] };
    try {
      d = JSON.parse(await file.text());
      if (d.app !== "tripbill" || !Array.isArray(d.trips)) throw new Error("bad file");
    } catch {
      alert("This is not a valid backup file.");
      return;
    }
    const parts = TABLES.filter((t) => Array.isArray(d[t])).map((t) => `${(d[t] as unknown[]).length} ${t}`);
    const msg = `This backup has: ${parts.join(", ")}.

These will REPLACE your current online data on all devices. Anything not in the backup is left as it is. Continue?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const ok = await api.replaceAll({ ...d, settings: migrateSettings(d.settings).settings, trips: d.trips! });
    setBusy(false);
    if (ok) api.toast("Backup restored ✔");
  };

  const wipe = async () => {
    if (!confirm("Are you sure? ALL trips, expenses, customers, vehicles and payments will be deleted from ALL devices.")) return;
    if (prompt("Type DELETE to confirm") !== "DELETE") return;
    if (await api.wipeAll()) api.toast("All data deleted");
  };

  return (
    <>
      <Card title="Backup (Extra Safety)">
        <p className="mb-2">
          Your data is saved online and show on every device where you log in. Still, download a backup file{" "}
          <b>once a month</b> and keep it on Google Drive or WhatsApp, in case of any account problem.
        </p>
        <p className="mb-2">
          Moving from an older version? Open the old version, click <b>Download Backup</b> there, then click{" "}
          <b>Restore Backup</b> here.
        </p>
        <p className="mb-3 text-[13px] text-muted">
          {last ? `Last backup on this device: ${new Date(last).toLocaleString("en-PK")}` : "No backup downloaded on this device yet."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="success" onClick={download}>⬇ Download Backup (.json)</Button>
          <label className={`cursor-pointer rounded-lg border border-brand bg-white px-4 py-2.5 font-medium text-brand hover:bg-soft ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? "Restoring…" : "⬆ Restore Backup"}
            <input type="file" accept=".json,application/json" className="hidden" onChange={restore} />
          </label>
        </div>
      </Card>
      <Card title="Danger Zone">
        <Button variant="danger" onClick={wipe}>Delete All Data</Button>
      </Card>
    </>
  );
}
