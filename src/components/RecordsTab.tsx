"use client";

import { useMemo, useState } from "react";
import { buildCsv, downloadBillPdf } from "@/lib/pdf";
import {
  billNo, downloadBlob, formatVehicleNo, inRange, periodText, rangeFor, rs, sortTrips, sums, up, type RangePreset,
} from "@/lib/utils";
import { Button, Card, Field, Stat, grid } from "./ui";
import { TripTable } from "./TripTable";
import type { AppApi } from "./types";

interface Props {
  api: AppApi;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RecordsTab({ api, onEdit, onDelete }: Props) {
  const { trips, settings, customers } = api;
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor("thismonth"));
  const [customerId, setCustomerId] = useState(() => (customers.length === 1 ? customers[0].id : ""));
  const [vehicle, setVehicle] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => a.name.localeCompare(b.name)), [customers]);

  const list = useMemo(() => {
    const v = up(vehicle), q = query.trim().toUpperCase();
    return sortTrips(
      trips.filter(
        (t) =>
          inRange(t.date, from, to) &&
          (!customerId || t.customerId === customerId) &&
          (!v || t.vehicleNo.includes(v)) &&
          (!q || [t.from, t.to, t.slipNo, t.biltyNo, t.notes, t.route, t.qty, t.vehicleType, t.driverName, t.hiredParty]
            .join(" ").toUpperCase().includes(q)),
      ),
    );
  }, [trips, from, to, customerId, vehicle, query]);
  const s = sums(list);
  const period = periodText(list, from, to);
  const mixed = !customerId && new Set(list.map((t) => t.customerId)).size > 1;

  const needCustomer = () => {
    if (!list.length) { alert("No trips match this filter."); return false; }
    if (mixed) { alert("A bill is for one customer. Please choose the Customer first."); return false; }
    return true;
  };

  const billCustomer = customer ?? customers.find((c) => c.id === list[0]?.customerId) ?? null;

  const pdf = async () => {
    if (!needCustomer()) return;
    setBusy(true);
    try {
      await downloadBillPdf(list, settings, period, billCustomer);
      api.toast("PDF downloaded ✔");
    } catch (e) {
      console.error(e);
      alert('Could not create the PDF. Use the Print button and choose "Save as PDF" instead.');
    } finally {
      setBusy(false);
    }
  };
  const csv = () => {
    if (!list.length) { alert("No trips found."); return; }
    downloadBlob(buildCsv(list, api.customerName), `Trips_${period.replace(/\//g, "-").replace(/ /g, "")}.csv`);
  };
  const print = () => { if (needCustomer()) window.print(); };

  return (
    <>
      <div className="print:hidden">
        <Card title="Find Trips">
          <div className={grid}>
            <Field label="Customer">
              <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">All customers</option>
                {sortedCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="From Date">
              <input type="date" className="field" value={from} onChange={(e) => setRange([e.target.value, to])} />
            </Field>
            <Field label="To Date">
              <input type="date" className="field" value={to} onChange={(e) => setRange([from, e.target.value])} />
            </Field>
            <Field label="Vehicle No.">
              <input className="field" placeholder="All vehicles" autoCapitalize="characters" autoComplete="off" value={vehicle}
                onChange={(e) => setVehicle(formatVehicleNo(e.target.value))} />
            </Field>
            <Field label="Search (place, slip, driver, notes)">
              <input className="field" placeholder="Any word" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["thismonth", "lastmonth", "week", "all"] as RangePreset[]).map((r) => (
              <Button key={r} small variant="secondary" onClick={() => setRange(rangeFor(r))}>
                {{ thismonth: "This Month", lastmonth: "Last Month", week: "Last 7 Days", all: "All" }[r]}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Trips" value={String(s.n)} />
            <Stat label="Fare" value={rs(s.rent)} />
            <Stat label={`Loading/Unloading (${s.loadN})`} value={rs(s.load)} />
            <Stat label={`Detention (${s.detentionN})`} value={rs(s.detention)} />
            <Stat label="Extra" value={rs(s.extra)} />
            <Stat label="Bill Total" value={rs(s.total)} highlight />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button onClick={pdf} disabled={busy}>{busy ? "Creating PDF…" : "⬇ Download PDF Bill"}</Button>
            <Button variant="secondary" onClick={print}>🖨 Print</Button>
            <Button variant="secondary" onClick={csv}>⬇ Excel (CSV)</Button>
            {mixed && <span className="text-[13px] text-[#7a4b00]">Choose a customer to make a bill.</span>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <TripTable trips={list} customerName={customerId ? undefined : api.customerName} onEdit={onEdit} onDelete={onDelete} showTotal={list.length > 0} />
          </div>
        </Card>
      </div>

      {/* Only visible when printing — this is the customer's bill */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold">{settings.businessName}</h2>
        <div className="text-sm">{[settings.phone && `Phone: ${settings.phone}`, settings.address].filter(Boolean).join("  |  ")}</div>
        <p className="my-2 text-sm">
          <b>Bill To:</b> {billCustomer?.name}
          {billCustomer?.address ? `, ${billCustomer.address}` : ""} &nbsp;|&nbsp; <b>Bill No:</b> {billNo()} &nbsp;|&nbsp; <b>Period:</b> {period}
        </p>
        <TripTable trips={list} showTotal print />
        <h3 className="mt-3 text-right text-lg font-bold">Grand Total: {rs(s.total)}</h3>
        <div className="mt-14 flex justify-between text-sm">
          <span>____________________<br />Prepared By</span>
          <span>____________________<br />Received / Approved By</span>
        </div>
      </div>
    </>
  );
}
