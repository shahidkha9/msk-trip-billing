"use client";

import { useMemo, useState } from "react";
import { ownerDues } from "@/lib/reports";
import type { Trip } from "@/lib/types";
import { fmtDate, hiredCostOf, num, rs, sortTrips, sumBy, today, tripTotal } from "@/lib/utils";
import { Button, Card } from "./ui";
import type { AppApi } from "./types";

type PayFilter = "unpaid" | "paid" | "all";

/** What you owe vehicle owners (family vehicles and outside vehicles), and marking it paid. */
export function PaymentsTab({ api, onEditTrip }: { api: AppApi; onEditTrip: (id: string) => void }) {
  const { trips } = api;
  const [filter, setFilter] = useState<PayFilter>("unpaid");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const ownerTrips = useMemo(() => sortTrips(trips.filter((t) => t.hired)), [trips]);
  const dues = useMemo(() => ownerDues(trips), [trips]);
  const unpaid = ownerTrips.filter((t) => !t.hiredPaid);
  const unpaidTotal = sumBy(unpaid, hiredCostOf);
  const owners = useMemo(() => [...new Set(ownerTrips.map((t) => t.hiredParty || "(no name)"))].sort(), [ownerTrips]);
  const shown = ownerTrips.filter(
    (t) => (filter === "all" || (filter === "paid" ? t.hiredPaid : !t.hiredPaid)) && (!owner || (t.hiredParty || "(no name)") === owner),
  );

  const setPaid = async (t: Trip, paid: boolean) => {
    setBusy(t.id);
    const ok = await api.save("trips", { ...t, hiredPaid: paid, hiredPaidDate: paid ? today() : "" });
    setBusy(null);
    if (ok) api.toast(paid ? `Paid ${t.hiredParty} ${rs(t.hiredCost)} ✔` : "Marked as not paid");
  };
  const payAll = async (name: string) => {
    const list = unpaid.filter((t) => (t.hiredParty || "(no name)") === name);
    const amount = sumBy(list, hiredCostOf);
    if (!confirm(`Mark ALL ${list.length} trips of "${name}" as paid?\nTotal: ${rs(amount)}`)) return;
    setBusy(name);
    let done = 0;
    for (const t of list) if (await api.save("trips", { ...t, hiredPaid: true, hiredPaidDate: today() })) done++;
    setBusy(null);
    api.toast(`${done} trips marked paid ✔`);
  };

  return (
    <Card title="Owner Payments — what you owe vehicle owners">
      <p className="mb-3 text-[13px] text-muted">
        Trips done by a vehicle that belongs to someone else (family or outside). Set the owner on the vehicle in <b>🚚 Fleet</b>,
        or choose &quot;Another owner&quot; on the trip.
      </p>
      <div className="mb-3 rounded-xl bg-[#fdecea] px-4 py-3">
        <div className="text-[13px] text-bad">You still have to pay ({unpaid.length} {unpaid.length === 1 ? "trip" : "trips"})</div>
        <div className="text-2xl font-bold text-bad">{rs(unpaidTotal)}</div>
      </div>

      {dues.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
            <thead><tr><th>Owner</th><th>Unpaid trips</th><th className="text-right!">Amount due</th><th></th></tr></thead>
            <tbody>
              {dues.map((d) => (
                <tr key={d.owner}>
                  <td className="font-semibold">{d.owner}</td>
                  <td>{d.trips}</td>
                  <td className="text-right font-bold text-bad">{num(d.amount)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button small variant="success" disabled={busy === d.owner} onClick={() => payAll(d.owner)}>✔ Mark all paid</Button>
                      <Button small variant="secondary" onClick={() => { setOwner(d.owner); setFilter("unpaid"); }}>See trips</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["unpaid", "paid", "all"] as PayFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${filter === f ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
            {{ unpaid: "Not paid", paid: "Paid", all: "All" }[f]}
          </button>
        ))}
        <select className="field max-w-56" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        {shown.length === 0 ? (
          <p className="p-4 text-[13px] text-muted">{ownerTrips.length === 0 ? "No owner trips yet." : "Nothing here."}</p>
        ) : (
          <table className="w-full border-collapse text-[13.5px] [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
            <thead>
              <tr><th>Date</th><th>Owner</th><th>Vehicle</th><th>From → To</th><th className="text-right!">Bill amount</th><th className="text-right!">You pay</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className="hover:bg-[#fafcff]">
                  <td>{fmtDate(t.date)}</td>
                  <td className="font-semibold">{t.hiredParty}</td>
                  <td>{t.vehicleNo}</td>
                  <td>{t.from} → {t.to}</td>
                  <td className="text-right">{num(tripTotal(t))}</td>
                  <td className="text-right font-bold">{num(t.hiredCost)}</td>
                  <td>
                    {t.hiredPaid
                      ? <span className="rounded-md bg-[#e8f6f0] px-2 py-0.5 text-xs font-semibold text-ok">Paid {fmtDate(t.hiredPaidDate)}</span>
                      : <span className="rounded-md bg-[#fdecea] px-2 py-0.5 text-xs font-semibold text-bad">Not paid</span>}
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      {t.hiredPaid
                        ? <Button small variant="secondary" disabled={busy === t.id} onClick={() => setPaid(t, false)}>Undo</Button>
                        : <Button small variant="success" disabled={busy === t.id} onClick={() => setPaid(t, true)}>✔ Mark Paid</Button>}
                      <Button small variant="secondary" onClick={() => onEditTrip(t.id)}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
