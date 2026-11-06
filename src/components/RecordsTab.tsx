"use client";

import { useMemo, useState } from "react";
import { buildCsv, downloadBillPdf } from "@/lib/pdf";
import { billNo, downloadBlob, formatVehicleNo, isoLocal, periodText, rs, sortTrips, sums, today, up } from "@/lib/utils";
import { Button, Card, Field, Stat, grid } from "./ui";
import { TripTable } from "./TripTable";
import type { AppApi } from "./types";

interface Props {
  api: AppApi;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RecordsTab({ api, onEdit, onDelete }: Props) {
  const { trips, settings } = api;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const v = up(vehicle), q = query.trim().toUpperCase();
    return sortTrips(
      trips.filter(
        (t) =>
          (!from || t.date >= from) &&
          (!to || t.date <= to) &&
          (!v || t.vehicleNo.includes(v)) &&
          (!q || [t.from, t.to, t.slipNo, t.biltyNo, t.notes, t.route, t.qty, t.vehicleType].join(" ").toUpperCase().includes(q)),
      ),
    );
  }, [trips, from, to, vehicle, query]);
  const s = sums(list);
  const period = periodText(list, from, to);

  const setRange = (r: "thismonth" | "lastmonth" | "week" | "all") => {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (r === "thismonth") { setFrom(isoLocal(new Date(y, m, 1))); setTo(isoLocal(new Date(y, m + 1, 0))); }
    if (r === "lastmonth") { setFrom(isoLocal(new Date(y, m - 1, 1))); setTo(isoLocal(new Date(y, m, 0))); }
    if (r === "week") { setFrom(isoLocal(new Date(y, m, d.getDate() - 6))); setTo(today()); }
    if (r === "all") { setFrom(""); setTo(""); }
  };

  const pdf = async () => {
    if (!list.length) { alert("No entries match this filter."); return; }
    setBusy(true);
    try {
      await downloadBillPdf(list, settings, period);
      api.toast("PDF downloaded ✔");
    } catch (e) {
      console.error(e);
      alert('Could not create the PDF. Use the Print button and choose "Save as PDF" instead.');
    } finally {
      setBusy(false);
    }
  };
  const csv = () => {
    if (!list.length) { alert("No entries found."); return; }
    downloadBlob(buildCsv(list), `Trips_${period.replace(/\//g, "-").replace(/ /g, "")}.csv`);
  };
  const print = () => {
    if (!list.length) { alert("No entries found."); return; }
    window.print();
  };

  return (
    <>
      <div className="print:hidden">
        <Card title="Filter">
          <div className={grid}>
            <Field label="From Date">
              <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To Date">
              <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Vehicle No.">
              <input className="field" placeholder="All vehicles" autoCapitalize="characters" autoComplete="off" value={vehicle}
                onChange={(e) => setVehicle(formatVehicleNo(e.target.value))} />
            </Field>
            <Field label="Search (location, slip, notes)">
              <input className="field" placeholder="Any word" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button small variant="secondary" onClick={() => setRange("thismonth")}>This Month</Button>
            <Button small variant="secondary" onClick={() => setRange("lastmonth")}>Last Month</Button>
            <Button small variant="secondary" onClick={() => setRange("week")}>Last 7 Days</Button>
            <Button small variant="secondary" onClick={() => setRange("all")}>All</Button>
          </div>
        </Card>

        <Card>
          <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Trips" value={String(s.n)} />
            <Stat label="Fare" value={rs(s.rent)} />
            <Stat label={`Loading/Unloading (${s.loadN})`} value={rs(s.load)} />
            <Stat label={`Detention (${s.detentionN})`} value={rs(s.detention)} />
            <Stat label="Extra" value={rs(s.extra)} />
            <Stat label="Grand Total" value={rs(s.total)} highlight />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button onClick={pdf} disabled={busy}>{busy ? "Creating PDF…" : "⬇ Download PDF Bill"}</Button>
            <Button variant="secondary" onClick={print}>🖨 Print</Button>
            <Button variant="secondary" onClick={csv}>⬇ Excel (CSV)</Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <TripTable trips={list} onEdit={onEdit} onDelete={onDelete} showTotal={list.length > 0} />
          </div>
        </Card>
      </div>

      {/* Only visible when printing */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold">{settings.businessName}</h2>
        {settings.phone && <div>Phone: {settings.phone}</div>}
        <p className="my-2 text-sm">
          <b>Bill To:</b> {settings.billTo} &nbsp;|&nbsp; <b>Bill No:</b> {billNo()} &nbsp;|&nbsp; <b>Period:</b> {period}
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
