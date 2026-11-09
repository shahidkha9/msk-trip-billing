"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { accessOf } from "@/lib/access";
import { adminListUsers, adminUpdateUser, errMsg } from "@/lib/db";
import type { AdminUser } from "@/lib/types";
import { addMonths, fmtDateTime } from "@/lib/utils";
import { Button, Card, Stat } from "./ui";
import type { AppApi } from "./types";

/** Only visible to the admin: all accounts, activate / extend / suspend. */
export function AdminTab({ api }: { api: AppApi }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await adminListUsers()); } catch (e) { alert("Could not load accounts: " + errMsg(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (u: AdminUser, change: Partial<AdminUser>, msg: string) => {
    setBusy(u.userId);
    try {
      await adminUpdateUser({ ...u, ...change });
      api.toast(msg);
      await load();
    } catch (e) {
      alert("Could not update: " + errMsg(e));
    }
    setBusy(null);
  };

  const extend = (u: AdminUser, months: number) => {
    const base = u.paidUntil && new Date(u.paidUntil) > new Date() ? new Date(u.paidUntil) : new Date();
    const until = addMonths(base, months).toISOString();
    if (!confirm(`Activate "${u.businessName || u.email}" for ${months} month(s)?\nPaid until: ${fmtDateTime(until)}`)) return;
    update(u, { paidUntil: until, status: "active" }, `Active until ${fmtDateTime(until)} ✔`);
  };
  const toggleSuspend = (u: AdminUser) => {
    const s = u.status === "suspended" ? "active" : "suspended";
    if (!confirm(`${s === "suspended" ? "Suspend" : "Re-activate"} "${u.businessName || u.email}"?`)) return;
    update(u, { status: s }, s === "suspended" ? "Account suspended" : "Account re-activated");
  };
  const editNote = (u: AdminUser) => {
    const note = prompt("Note (e.g. paid Rs 1000 JazzCash 5 Nov):", u.adminNote);
    if (note === null) return;
    update(u, { adminNote: note }, "Note saved ✔");
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => !s || [u.email, u.businessName, u.phone, u.adminNote].join(" ").toLowerCase().includes(s));
  }, [users, q]);

  const counts = useMemo(() => {
    const c = { total: users.length, trial: 0, paid: 0, expired: 0 };
    for (const u of users) {
      const k = accessOf(u).kind;
      if (k === "trial") c.trial++;
      else if (k === "paid") c.paid++;
      else if (k === "expired" || k === "suspended") c.expired++;
    }
    return c;
  }, [users]);

  const badge = (u: AdminUser) => {
    const a = accessOf(u);
    const map = {
      admin: ["bg-soft text-brand", "Admin"],
      trial: ["bg-[#fff7e6] text-[#7a4b00]", `Trial · ${a.daysLeft}d left`],
      paid: ["bg-[#e8f6f0] text-ok", `Paid · until ${fmtDateTime(a.until)}`],
      expired: ["bg-[#fdecea] text-bad", "Expired"],
      suspended: ["bg-[#fdecea] text-bad", "Suspended"],
      unknown: ["bg-soft", "?"],
    } as const;
    const [cls, txt] = map[a.kind];
    return <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{txt}</span>;
  };

  return (
    <Card title="Admin — Customer Accounts">
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="All accounts" value={String(counts.total)} />
        <Stat label="On free trial" value={String(counts.trial)} />
        <Stat label="Paying" value={String(counts.paid)} highlight />
        <Stat label="Expired / suspended" value={String(counts.expired)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="field max-w-72" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={load} disabled={loading}>{loading ? "Loading…" : "⟳ Refresh"}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13px] [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
          <thead>
            <tr><th>Business</th><th>Contact</th><th>Joined</th><th>Status</th><th>Trips</th><th>Last used</th><th>Note</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.userId}>
                <td className="font-semibold">{u.businessName || "—"}</td>
                <td>{u.email}<div className="text-muted">{u.phone}</div></td>
                <td className="whitespace-nowrap">{fmtDateTime(u.createdAt)}</td>
                <td>{badge(u)}</td>
                <td>{u.tripCount}</td>
                <td className="whitespace-nowrap">{fmtDateTime(u.lastActivity)}</td>
                <td className="max-w-48 text-muted">{u.adminNote}</td>
                <td>
                  {!u.isAdmin && (
                    <div className="flex flex-wrap gap-1">
                      <Button small variant="success" disabled={busy === u.userId} onClick={() => extend(u, 1)}>+1 month</Button>
                      <Button small variant="success" disabled={busy === u.userId} onClick={() => extend(u, 3)}>+3</Button>
                      <Button small variant="success" disabled={busy === u.userId} onClick={() => extend(u, 12)}>+12</Button>
                      <Button small variant={u.status === "suspended" ? "secondary" : "danger"} disabled={busy === u.userId} onClick={() => toggleSuspend(u)}>
                        {u.status === "suspended" ? "Unsuspend" : "Suspend"}
                      </Button>
                      <Button small variant="secondary" disabled={busy === u.userId} onClick={() => editNote(u)}>Note</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && list.length === 0 && (
              <tr><td colSpan={8} className="text-muted">No accounts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        When a customer pays you, click <b>+1 month</b> (or +3 / +12). The time is added after their current paid date.
        Expired accounts can still log in and download their data, but cannot add or change anything.
      </p>
    </Card>
  );
}
