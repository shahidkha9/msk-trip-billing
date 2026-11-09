"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/types";
import { fmtDate, hiredCostOf, inRange, num, rangeFor, rs, sortTrips, today, tripTotal, type RangePreset } from "@/lib/utils";
import { Button, Card, Field, grid } from "./ui";
import type { AppApi } from "./types";

type PayFilter = "unpaid" | "paid" | "all";

export function ProfitTab({ api, onEditTrip }: { api: AppApi; onEditTrip: (id: string) => void }) {
  const { trips, expenses } = api;
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor("thismonth"));
  const [payFilter, setPayFilter] = useState<PayFilter>("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ---------- profit for the selected period ---------- */
  const r = useMemo(() => {
    const t = trips.filter((x) => inRange(x.date, from, to));
    const e = expenses.filter((x) => inRange(x.date, from, to));
    const own = t.filter((x) => !x.hired);
    const hired = t.filter((x) => x.hired);
    const income = t.reduce((s, x) => s + tripTotal(x), 0);
    const ownIncome = own.reduce((s, x) => s + tripTotal(x), 0);
    const hiredIncome = hired.reduce((s, x) => s + tripTotal(x), 0);
    const hiredCost = hired.reduce((s, x) => s + hiredCostOf(x), 0);
    const expenseTotal = e.reduce((s, x) => s + x.amount, 0);
    const byCat: Record<string, number> = {};
    for (const x of e) byCat[x.category] = (byCat[x.category] || 0) + x.amount;
    return {
      trips: t.length, ownN: own.length, hiredN: hired.length, income, ownIncome, hiredIncome, hiredCost,
      expenseTotal, expenseN: e.length, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
      profit: income - hiredCost - expenseTotal,
    };
  }, [trips, expenses, from, to]);

  /* ---------- outside vehicle payments (all dates) ---------- */
  const hiredTrips = useMemo(() => sortTrips(trips.filter((t) => t.hired)), [trips]);
  const unpaid = hiredTrips.filter((t) => !t.hiredPaid);
  const unpaidTotal = unpaid.reduce((s, t) => s + hiredCostOf(t), 0);
  const byParty = useMemo(() => {
    const m: Record<string, { n: number; amount: number }> = {};
    for (const t of unpaid) {
      const k = t.hiredParty || "(no name)";
      m[k] = m[k] || { n: 0, amount: 0 };
      m[k].n++;
      m[k].amount += hiredCostOf(t);
    }
    return Object.entries(m).sort((a, b) => b[1].amount - a[1].amount);
  }, [unpaid]);
  const shown = hiredTrips.filter((t) => (payFilter === "all" ? true : payFilter === "paid" ? t.hiredPaid : !t.hiredPaid));

  const setPaid = async (t: Trip, paid: boolean) => {
    setBusyId(t.id);
    const ok = await api.saveTrip({ ...t, hiredPaid: paid, hiredPaidDate: paid ? today() : "" });
    setBusyId(null);
    if (ok) api.toast(paid ? `Marked paid: ${t.hiredParty} ${rs(t.hiredCost)} ✔` : "Marked as not paid");
  };
  const payAll = async (party: string) => {
    const list = unpaid.filter((t) => (t.hiredParty || "(no name)") === party);
    const amount = list.reduce((s, t) => s + hiredCostOf(t), 0);
    if (!confirm(`Mark ALL ${list.length} trips of "${party}" as paid?\nTotal: ${rs(amount)}`)) return;
    setBusyId(party);
    let done = 0;
    for (const t of list) if (await api.saveTrip({ ...t, hiredPaid: true, hiredPaidDate: today() })) done++;
    setBusyId(null);
    api.toast(`${done} trips marked paid ✔`);
  };

  const profitColor = r.profit < 0 ? "text-bad" : "text-ok";

  return (
    <>
      <Card title="Profit Report">
        <div className={grid}>
          <Field label="From Date">
            <input type="date" className="field" value={from} onChange={(e) => setRange([e.target.value, to])} />
          </Field>
          <Field label="To Date">
            <input type="date" className="field" value={to} onChange={(e) => setRange([from, e.target.value])} />
          </Field>
        </div>
        <div className="mt-3 mb-4 flex flex-wrap gap-2 print:hidden">
          {(["thismonth", "lastmonth", "week", "all"] as RangePreset[]).map((p) => (
            <Button key={p} small variant="secondary" onClick={() => setRange(rangeFor(p))}>
              {{ thismonth: "This Month", lastmonth: "Last Month", week: "Last 7 Days", all: "All" }[p]}
            </Button>
          ))}
          <Button small variant="secondary" onClick={() => window.print()}>🖨 Print</Button>
        </div>

        {!api.expensesReady && (
          <p className="mb-3 rounded-lg border border-[#f5d38a] bg-[#fff7e6] px-3 py-2 text-sm text-[#7a4b00]">
            Expenses are not set up yet, so they are not included. See the <b>Expenses</b> tab.
          </p>
        )}

        {/* Statement */}
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse text-[15px] [&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-2.5 [&_td:last-child]:whitespace-nowrap">
            <tbody>
              <tr className="bg-[#f7f9fc]">
                <td className="font-semibold" colSpan={2}>
                  Period: {from ? fmtDate(from) : "Start"} to {to ? fmtDate(to) : "Today"}
                </td>
              </tr>
              <tr>
                <td>
                  Income from trips <span className="text-[13px] text-muted">({r.trips} trips: {r.ownN} own, {r.hiredN} outside)</span>
                </td>
                <td className="text-right font-semibold">{rs(r.income)}</td>
              </tr>
              <tr>
                <td>
                  Less: paid / payable to outside vehicles <span className="text-[13px] text-muted">({r.hiredN} trips)</span>
                </td>
                <td className="text-right font-semibold text-bad">− {num(r.hiredCost)}</td>
              </tr>
              <tr>
                <td>
                  Less: expenses <span className="text-[13px] text-muted">({r.expenseN} entries)</span>
                  {r.byCat.length > 0 && (
                    <div className="mt-1 space-y-0.5 pl-3 text-[13px] text-muted">
                      {r.byCat.map(([c, v]) => (
                        <div key={c} className="flex justify-between gap-4">
                          <span>• {c}</span>
                          <span>{num(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="align-top text-right font-semibold text-bad">− {num(r.expenseTotal)}</td>
              </tr>
              <tr className="bg-soft">
                <td className="text-lg font-bold">NET PROFIT</td>
                <td className={`text-right text-2xl font-bold ${profitColor}`}>{rs(r.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {r.hiredN > 0 && (
          <p className="mt-3 text-[13px] text-muted">
            Outside vehicles: customers paid {rs(r.hiredIncome)}, you pay {rs(r.hiredCost)} → margin{" "}
            <b className={r.hiredIncome - r.hiredCost < 0 ? "text-bad" : "text-ok"}>{rs(r.hiredIncome - r.hiredCost)}</b>.
            Own vehicles earned {rs(r.ownIncome)} (before expenses).
          </p>
        )}
      </Card>

      <div className="print:hidden">
        <Card title="Outside Vehicle Payments">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fdecea] px-4 py-3">
            <div>
              <div className="text-[13px] text-bad">You still have to pay ({unpaid.length} {unpaid.length === 1 ? "trip" : "trips"})</div>
              <div className="text-2xl font-bold text-bad">{rs(unpaidTotal)}</div>
            </div>
          </div>

          {byParty.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
                <thead>
                  <tr><th>Owner / Driver</th><th>Unpaid trips</th><th className="text-right!">Amount due</th><th></th></tr>
                </thead>
                <tbody>
                  {byParty.map(([party, v]) => (
                    <tr key={party}>
                      <td className="font-semibold">{party}</td>
                      <td>{v.n}</td>
                      <td className="text-right font-bold text-bad">{num(v.amount)}</td>
                      <td>
                        <Button small variant="success" disabled={busyId === party} onClick={() => payAll(party)}>
                          ✔ Mark all paid
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            {(["unpaid", "paid", "all"] as PayFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${payFilter === f ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
              >
                {{ unpaid: "Not paid", paid: "Paid", all: "All" }[f]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            {shown.length === 0 ? (
              <p className="p-4 text-[13px] text-muted">
                {hiredTrips.length === 0
                  ? 'No outside vehicle trips yet. When you add a trip, choose "Outside (hired) vehicle".'
                  : "Nothing here."}
              </p>
            ) : (
              <table className="w-full border-collapse text-[13.5px] [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
                <thead>
                  <tr>
                    <th>Date</th><th>Owner / Driver</th><th>Vehicle</th><th>From → To</th>
                    <th className="text-right!">Customer pays</th><th className="text-right!">You pay</th><th>Status</th><th></th>
                  </tr>
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
                        {t.hiredPaid ? (
                          <span className="rounded-md bg-[#e8f6f0] px-2 py-0.5 text-xs font-semibold text-ok">
                            Paid {t.hiredPaidDate ? fmtDate(t.hiredPaidDate) : ""}
                          </span>
                        ) : (
                          <span className="rounded-md bg-[#fdecea] px-2 py-0.5 text-xs font-semibold text-bad">Not paid</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          {t.hiredPaid ? (
                            <Button small variant="secondary" disabled={busyId === t.id} onClick={() => setPaid(t, false)}>Undo</Button>
                          ) : (
                            <Button small variant="success" disabled={busyId === t.id} onClick={() => setPaid(t, true)}>✔ Mark Paid</Button>
                          )}
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
      </div>
    </>
  );
}
