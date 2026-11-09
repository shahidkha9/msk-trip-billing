"use client";

import { useMemo, useState } from "react";
import { expenseSummary, perDriver, perVehicle, tripProfit } from "@/lib/reports";
import { csvBlob, downloadBlob, fmtDate, inRange, num, rangeFor, rs, type RangePreset } from "@/lib/utils";
import { Button, Card, Field, grid } from "./ui";
import type { AppApi } from "./types";

const th = "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left";
const td = "[&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2";
const money = (n: number) => <span className={n < 0 ? "text-bad" : ""}>{num(n)}</span>;

/** Trip profit, expenses and net profit — plus per-vehicle and per-driver results. */
export function ReportsTab({ api }: { api: AppApi }) {
  const { trips, expenses, vehicles } = api;
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor("thismonth"));

  const t = useMemo(() => trips.filter((x) => inRange(x.date, from, to)), [trips, from, to]);
  const e = useMemo(() => expenses.filter((x) => inRange(x.date, from, to)), [expenses, from, to]);
  const tp = tripProfit(t);
  const ex = expenseSummary(e);
  const net = tp.profit - ex.total;
  const vRows = useMemo(() => perVehicle(t, e, vehicles), [t, e, vehicles]);
  const dRows = useMemo(() => perDriver(t, e, vehicles), [t, e, vehicles]);
  const period = `${from ? fmtDate(from) : "Start"} to ${to ? fmtDate(to) : "Today"}`;

  const exportCsv = () => {
    downloadBlob(csvBlob([
      [`Report: ${period}`],
      [],
      ["TRIP PROFIT"], ["Income from trips", tp.income], ["Paid / payable to vehicle owners", -tp.ownerPay], ["Trip profit", tp.profit],
      [],
      ["EXPENSES"], ...ex.byCategory.map(([c, v]) => [c, -v]), ["Total expenses", -ex.total],
      [],
      ["NET PROFIT", net],
      [],
      ["PER VEHICLE"], ["Vehicle", "Type", "Owner", "Driver", "Trips", "Income", "Owner payment", "Expenses", "Profit"],
      ...vRows.map((r) => [r.vehicleNo, r.type, r.owner || "Me", r.driver, r.trips, r.income, r.ownerPay, r.expenses, r.profit]),
      [],
      ["PER DRIVER"], ["Driver", "Vehicles", "Trips", "Trip income", "Salary paid", "Other paid to driver"],
      ...dRows.map((r) => [r.driver, r.vehicles.join(" "), r.trips, r.income, r.salary, r.otherPaid]),
    ]), `Report_${(from || "all")}_${to || ""}.csv`);
  };

  return (
    <>
      <Card title="Reports" className="print:border-0 print:p-0">
        <div className={`${grid} print:hidden`}>
          <Field label="From Date">
            <input type="date" className="field" value={from} onChange={(ev) => setRange([ev.target.value, to])} />
          </Field>
          <Field label="To Date">
            <input type="date" className="field" value={to} onChange={(ev) => setRange([from, ev.target.value])} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {(["thismonth", "lastmonth", "week", "all"] as RangePreset[]).map((p) => (
            <Button key={p} small variant="secondary" onClick={() => setRange(rangeFor(p))}>
              {{ thismonth: "This Month", lastmonth: "Last Month", week: "Last 7 Days", all: "All" }[p]}
            </Button>
          ))}
          <Button small variant="secondary" onClick={() => window.print()}>🖨 Print</Button>
          <Button small variant="secondary" onClick={exportCsv}>⬇ Excel (CSV)</Button>
        </div>
        <p className="mt-3 font-semibold">Period: {period}</p>
      </Card>

      {/* Profit summary: 3 separate blocks */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 font-semibold text-brand">① Trip Profit</h3>
          <Row label={`Income from trips (${tp.trips})`} value={rs(tp.income)} />
          <Row label={`Less: paid to vehicle owners (${tp.ownerTrips})`} value={`− ${num(tp.ownerPay)}`} bad />
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-lg font-bold">
            <span>Trip Profit</span><span className={tp.profit < 0 ? "text-bad" : "text-ok"}>{rs(tp.profit)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 font-semibold text-brand">② Expenses ({ex.count})</h3>
          {ex.byCategory.length === 0 && <p className="text-[13px] text-muted">No expenses in this period.</p>}
          {ex.byCategory.map(([c, v]) => <Row key={c} label={c} value={num(v)} />)}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-lg font-bold">
            <span>Total Expenses</span><span className="text-bad">{rs(ex.total)}</span>
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${net < 0 ? "border-[#f3b8b2] bg-[#fdecea]" : "border-[#bfe5d3] bg-[#e8f6f0]"}`}>
          <h3 className="mb-2 font-semibold text-brand">③ Net Profit</h3>
          <Row label="Trip Profit" value={rs(tp.profit)} />
          <Row label="Less: Expenses" value={`− ${num(ex.total)}`} bad />
          <div className="mt-2 border-t border-line pt-2">
            <div className="text-sm">NET PROFIT</div>
            <div className={`text-3xl font-bold ${net < 0 ? "text-bad" : "text-ok"}`}>{rs(net)}</div>
          </div>
        </div>
      </div>

      <Card title="Per Vehicle">
        <div className="overflow-x-auto rounded-xl border border-line">
          {vRows.length === 0 ? <p className="p-4 text-[13px] text-muted">No vehicles or trips in this period.</p> : (
            <table className={`w-full border-collapse text-[13.5px] ${th} ${td}`}>
              <thead>
                <tr><th>Vehicle</th><th>Type</th><th>Owner</th><th>Driver</th><th>Trips</th><th className="text-right!">Income</th>
                  <th className="text-right!">Owner payment</th><th className="text-right!">Expenses</th><th className="text-right!">Profit</th></tr>
              </thead>
              <tbody>
                {vRows.map((r) => (
                  <tr key={r.vehicleNo}>
                    <td className="font-semibold">{r.vehicleNo}</td>
                    <td>{r.type}</td>
                    <td>{r.owner || <span className="text-muted">Me</span>}</td>
                    <td>{r.driver}</td>
                    <td>{r.trips}</td>
                    <td className="text-right">{num(r.income)}</td>
                    <td className="text-right">{r.ownerPay ? num(r.ownerPay) : "-"}</td>
                    <td className="text-right">{r.expenses ? num(r.expenses) : "-"}</td>
                    <td className={`text-right font-bold ${r.profit < 0 ? "text-bad" : "text-ok"}`}>{num(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">Vehicle expenses count only when the expense has a vehicle number. Office costs without a vehicle appear only in the totals above.</p>
      </Card>

      <Card title="Per Driver">
        <div className="overflow-x-auto rounded-xl border border-line">
          {dRows.length === 0 ? <p className="p-4 text-[13px] text-muted">No drivers yet. Add drivers in 🚚 Fleet & Drivers.</p> : (
            <table className={`w-full border-collapse text-[13.5px] ${th} ${td}`}>
              <thead>
                <tr><th>Driver</th><th>Vehicle(s)</th><th>Trips</th><th className="text-right!">Trip income</th>
                  <th className="text-right!">Salary paid</th><th className="text-right!">Other paid</th></tr>
              </thead>
              <tbody>
                {dRows.map((r) => (
                  <tr key={r.driver}>
                    <td className="font-semibold">{r.driver}</td>
                    <td>{r.vehicles.join(", ")}</td>
                    <td>{r.trips}</td>
                    <td className="text-right">{money(r.income)}</td>
                    <td className="text-right">{r.salary ? num(r.salary) : "-"}</td>
                    <td className="text-right">{r.otherPaid ? num(r.otherPaid) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">&quot;Salary paid&quot; = Driver Salary expenses with this driver in &quot;Paid To&quot;. &quot;Other paid&quot; = any other expense paid to them (advance, khurak…).</p>
      </Card>
    </>
  );
}

function Row({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[14px]">
      <span className="text-muted">{label}</span>
      <span className={`whitespace-nowrap font-semibold ${bad ? "text-bad" : ""}`}>{value}</span>
    </div>
  );
}
