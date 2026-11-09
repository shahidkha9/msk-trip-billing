"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Trip } from "@/lib/types";
import {
  fmtDate, formatVehicleNo, isBase, newId, num, otherParty, rs, sortTrips, today, tripTotal, uniqueSorted, up,
} from "@/lib/utils";
import { Button, Card, Field, grid } from "./ui";
import { TripTable } from "./TripTable";
import type { AppApi } from "./types";

interface Form {
  date: string;
  customerId: string;
  slipNo: string;
  biltyNo: string;
  vehicleNo: string;
  vehicleType: string;
  driverName: string;
  from: string;
  to: string;
  route: string;
  qty: string;
  rent: string;
  extra: string;
  loading: boolean;
  detention: boolean;
  notes: string;
  hired: boolean;
  hiredParty: string;
  hiredCost: string;
  hiredPaid: boolean;
}

interface Props {
  api: AppApi;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function EntryTab({ api, editingId, setEditingId, onDelete }: Props) {
  const { settings, trips, customers, vehicles } = api;
  const bases = settings.baseLocations;

  // Most recently used customer is the default for a new trip.
  const lastCustomer = useMemo(() => {
    const t = [...trips].sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    return (t && customers.some((c) => c.id === t.customerId) ? t.customerId : customers[0]?.id) ?? "";
  }, [trips, customers]);

  const emptyForm = (keep?: Partial<Form>): Form => ({
    date: today(), customerId: lastCustomer, slipNo: "", biltyNo: "", vehicleNo: "", vehicleType: settings.vehicles[0] ?? "",
    driverName: "", from: "", to: "", route: "", qty: "", rent: "", extra: "", loading: false, detention: false, notes: "",
    hired: false, hiredParty: "", hiredCost: "", hiredPaid: false, ...keep,
  });

  const [form, setForm] = useState<Form>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  /** true while the owner amount is being calculated from the vehicle's share % (stops once you type it yourself) */
  const [autoPay, setAutoPay] = useState(true);
  const editing = editingId ? trips.find((t) => t.id === editingId) ?? null : null;

  // When "Edit" is clicked somewhere, load that trip into the form.
  useEffect(() => {
    if (!editing) return;
    setForm({
      date: editing.date, customerId: editing.customerId, slipNo: editing.slipNo, biltyNo: editing.biltyNo,
      vehicleNo: editing.vehicleNo, vehicleType: editing.vehicleType, driverName: editing.driverName,
      from: editing.from, to: editing.to, route: editing.route, qty: editing.qty,
      rent: String(editing.rent || ""), extra: editing.extra ? String(editing.extra) : "",
      loading: editing.loading, detention: editing.detention, notes: editing.notes,
      hired: editing.hired, hiredParty: editing.hiredParty, hiredCost: editing.hiredCost ? String(editing.hiredCost) : "",
      hiredPaid: editing.hiredPaid,
    });
    setAutoPay(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // Old trips keep the charge they were saved with; new trips use today's setting.
  const loadAmt = editing?.loading && editing.loadAmt ? editing.loadAmt : settings.loadCharge;
  const detentionAmt = editing?.detention && editing.detentionAmt ? editing.detentionAmt : settings.detentionCharge;

  const rent = Number(form.rent) || 0;
  const extra = Number(form.extra) || 0;
  const ld = form.loading ? loadAmt : 0;
  const dt = form.detention ? detentionAmt : 0;
  const total = rent + ld + dt + extra;
  const fleetVehicle = vehicles.find((v) => v.vehicleNo === form.vehicleNo);
  const sharePct = fleetVehicle?.ownership === "owner" ? fleetVehicle.ownerSharePercent : 0;

  // Owner's share follows the trip total while it is automatic.
  useEffect(() => {
    if (!autoPay || !form.hired || !sharePct) return;
    const amount = String(Math.round((total * sharePct) / 100));
    if (amount !== form.hiredCost) setForm((f) => ({ ...f, hiredCost: amount }));
  }, [autoPay, form.hired, sharePct, total, form.hiredCost]);

  const hiredCost = form.hired ? Number(form.hiredCost) || 0 : 0;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fareFor = (route: string, vehicleType: string) => {
    const r = settings.routes[route];
    return r && r[vehicleType] ? String(r[vehicleType]) : null;
  };
  const changeRoute = (route: string) => setForm((f) => ({ ...f, route, rent: fareFor(route, f.vehicleType) ?? f.rent }));
  const changeVehicleType = (vehicleType: string) =>
    setForm((f) => ({ ...f, vehicleType, rent: f.route ? fareFor(f.route, vehicleType) ?? f.rent : f.rent }));

  /** Picking a vehicle from your fleet fills in its type, driver and owner. */
  const applyVehicle = (no: string) => {
    const v = vehicles.find((x) => x.vehicleNo === no);
    if (!v) return;
    setForm((f) => {
      const vehicleType = v.type && settings.vehicles.includes(v.type) ? v.type : f.vehicleType;
      return {
        ...f, vehicleNo: no, vehicleType, driverName: v.driverName || f.driverName,
        rent: f.route ? fareFor(f.route, vehicleType) ?? f.rent : f.rent,
        hired: v.ownership === "owner", hiredParty: v.ownership === "owner" ? v.ownerName : "",
        hiredCost: v.ownership === "owner" ? f.hiredCost : "", hiredPaid: false,
      };
    });
    setAutoPay(true);
  };

  /** If the place already has a route, fill in route + fare automatically. */
  const autoRoute = (from: string, to: string) => {
    const route = settings.locations[otherParty(from, to, bases)];
    if (route && settings.routes[route]) changeRoute(route);
  };
  const changeLocation = (k: "from" | "to", value: string) => {
    const next = { ...form, [k]: value };
    setForm(next);
    if (up(value) in settings.locations) autoRoute(next.from, next.to);
  };

  const addCustomer = async () => {
    const name = prompt("New customer (company) name:")?.trim();
    if (!name) return;
    if (customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) { alert("This customer already exists."); return; }
    const c: Customer = { id: newId(), name, phone: "", address: "", notes: "", created: Date.now() };
    if (await api.save("customers", c)) { set("customerId", c.id); api.toast(`Customer "${name}" added ✔`); }
  };

  const reset = (keep: boolean) => {
    setForm(keep
      ? emptyForm({
          date: form.date, customerId: form.customerId, vehicleNo: form.vehicleNo, vehicleType: form.vehicleType,
          driverName: form.driverName, hired: form.hired, hiredParty: form.hiredParty,
        })
      : emptyForm());
    setAutoPay(true);
    setEditingId(null);
  };

  const save = async () => {
    const vehicleNo = formatVehicleNo(form.vehicleNo, true);
    const missing: string[] = [];
    if (!form.date) missing.push("Date");
    if (!form.customerId) missing.push("Customer");
    if (!vehicleNo) missing.push("Vehicle No.");
    if (!form.from.trim()) missing.push("From");
    if (!form.to.trim()) missing.push("To");
    if (!rent) missing.push("Fare");
    if (form.hired && !form.hiredParty.trim()) missing.push("Vehicle owner name");
    if (form.hired && !hiredCost) missing.push("Amount to pay owner");
    if (missing.length) { alert("Please fill in: " + missing.join(", ")); return; }
    const slip = form.slipNo.trim();
    if (!editing && slip && trips.some((t) => t.slipNo === slip) && !confirm(`Slip No. ${slip} already exists. Save anyway?`)) return;

    const trip: Trip = {
      id: editing?.id ?? newId(),
      created: editing?.created ?? Date.now(),
      date: form.date, customerId: form.customerId, slipNo: slip, biltyNo: form.biltyNo.trim(), vehicleNo,
      vehicleType: form.vehicleType, driverName: form.driverName.trim(),
      from: up(form.from), to: up(form.to), route: form.route, qty: form.qty.trim(), rent, extra,
      loading: form.loading, loadAmt: form.loading ? loadAmt : 0,
      detention: form.detention, detentionAmt: form.detention ? detentionAmt : 0,
      notes: form.notes.trim(),
      hired: form.hired,
      hiredParty: form.hired ? form.hiredParty.trim() : "",
      hiredCost,
      hiredPaid: form.hired && form.hiredPaid,
      hiredPaidDate: form.hired && form.hiredPaid ? (editing?.hiredPaid && editing.hiredPaidDate ? editing.hiredPaidDate : today()) : "",
    };

    setSaving(true);
    const ok = await api.save("trips", trip);
    if (ok) {
      // Remember new places and their route for next time.
      const locations = { ...settings.locations };
      let changed = false;
      for (const l of [trip.from, trip.to]) if (!(l in locations)) { locations[l] = ""; changed = true; }
      const p = otherParty(trip.from, trip.to, bases);
      if (p && trip.route && !isBase(p, bases) && !locations[p]) { locations[p] = trip.route; changed = true; }
      if (changed) await api.updateSettings({ ...settings, locations });
      api.toast(editing ? "Trip updated ✔" : "Trip saved ✔");
      reset(true);
    }
    setSaving(false);
  };

  const dayTrips = useMemo(() => sortTrips(trips.filter((t) => t.date === (form.date || today()))), [trips, form.date]);
  const dayTotal = dayTrips.reduce((s, t) => s + tripTotal(t), 0);
  const locationList = useMemo(() => Object.keys(settings.locations).sort(), [settings.locations]);
  const vehicleList = useMemo(
    () => uniqueSorted([...vehicles.filter((v) => v.active).map((v) => v.vehicleNo), ...trips.map((t) => t.vehicleNo)]),
    [vehicles, trips],
  );
  const ownerList = useMemo(
    () => uniqueSorted([...vehicles.map((v) => v.ownerName), ...trips.map((t) => t.hiredParty)]),
    [vehicles, trips],
  );
  const driverList = useMemo(
    () => uniqueSorted([...vehicles.map((v) => v.driverName), ...trips.map((t) => t.driverName)]),
    [vehicles, trips],
  );
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => a.name.localeCompare(b.name)), [customers]);

  return (
    <>
      <Card title={editing ? "Edit Trip" : "New Trip"}>
        <div className={grid}>
          <Field label="Date *">
            <input type="date" className="field" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Customer (Bill To) *">
            <div className="flex gap-1.5">
              <select className="field" value={form.customerId} onChange={(e) => set("customerId", e.target.value)}>
                <option value="">-- Select customer --</option>
                {sortedCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button small variant="secondary" title="Add new customer" onClick={addCustomer}>+</Button>
            </div>
          </Field>
          <Field label="Slip No.">
            <input className="field" placeholder="e.g. 4843" value={form.slipNo} onChange={(e) => set("slipNo", e.target.value)} />
          </Field>
          <Field label="Bilty No.">
            <input className="field" placeholder="optional" value={form.biltyNo} onChange={(e) => set("biltyNo", e.target.value)} />
          </Field>
          <Field label="Vehicle No. *">
            <input
              className="field" list="vehicle-list" placeholder="abcd1234 → ABCD-1234" autoCapitalize="characters" autoComplete="off"
              value={form.vehicleNo}
              onChange={(e) => {
                const v = formatVehicleNo(e.target.value);
                set("vehicleNo", v);
                if (vehicles.some((x) => x.vehicleNo === v)) applyVehicle(v);
              }}
              onBlur={(e) => {
                const v = formatVehicleNo(e.target.value, true);
                set("vehicleNo", v);
                if (v !== form.vehicleNo || !fleetVehicle) applyVehicle(v);
              }}
            />
          </Field>
          <Field label="Vehicle Type *">
            <select className="field" value={form.vehicleType} onChange={(e) => changeVehicleType(e.target.value)}>
              {settings.vehicles.map((v) => <option key={v}>{v}</option>)}
              {form.vehicleType && !settings.vehicles.includes(form.vehicleType) && <option>{form.vehicleType}</option>}
            </select>
          </Field>
          <Field label="Driver">
            <input className="field" list="driver-list" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} />
          </Field>
          <Field label="Quantity (Bags/Ctns)">
            <input className="field" placeholder="e.g. 115 Bags" value={form.qty} onChange={(e) => set("qty", e.target.value)} />
          </Field>
          <Field label="From *">
            <input className="field" list="location-list" placeholder="Loading place" value={form.from}
              onChange={(e) => changeLocation("from", e.target.value)} onBlur={() => autoRoute(form.from, form.to)} />
          </Field>
          <Field label="To *">
            <input className="field" list="location-list" placeholder="Delivery place" value={form.to}
              onChange={(e) => changeLocation("to", e.target.value)} onBlur={() => autoRoute(form.from, form.to)} />
          </Field>
          <Field label="Route (Rate Area)">
            <select className="field" value={form.route} onChange={(e) => changeRoute(e.target.value)}>
              <option value="">-- No fixed rate --</option>
              {Object.keys(settings.routes).map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={form.route ? "Fare (Rs) — auto" : "Fare (Rs) *"}>
            <input type="number" min={0} inputMode="numeric" className="field" value={form.rent} onChange={(e) => set("rent", e.target.value)} />
          </Field>
          <Field label="Extra Charges (Rs)">
            <input type="number" min={0} inputMode="numeric" placeholder="0" className="field" value={form.extra} onChange={(e) => set("extra", e.target.value)} />
          </Field>
          <Field label="Notes">
            <input className="field" placeholder="Brand / Lot / remarks" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        {(settings.loadCharge > 0 || settings.detentionCharge > 0) && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {settings.loadCharge > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-soft p-2.5">
                <input type="checkbox" className="size-5 accent-brand" checked={form.loading} onChange={(e) => set("loading", e.target.checked)} />
                <span>Add Loading / Unloading charge (+ Rs {num(loadAmt)})</span>
              </label>
            )}
            {settings.detentionCharge > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-soft p-2.5">
                <input type="checkbox" className="size-5 accent-brand" checked={form.detention} onChange={(e) => set("detention", e.target.checked)} />
                <span>Add Detention charge (+ Rs {num(detentionAmt)})</span>
              </label>
            )}
          </div>
        )}

        {/* Whose vehicle? */}
        <div className="mt-3 rounded-xl border border-line p-3">
          <div className="mb-2 text-[13px] text-muted">
            Whose vehicle is this?
            {fleetVehicle && <span className="ml-1 text-ok">(from your fleet)</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { v: false, label: "🚚 My own vehicle" },
              { v: true, label: "🤝 Another owner — I pay them" },
            ].map((o) => (
              <button key={String(o.v)} type="button" onClick={() => set("hired", o.v)}
                className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm ${
                  form.hired === o.v ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}>
                {o.label}
              </button>
            ))}
          </div>
          {form.hired && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Vehicle owner *">
                <input className="field" list="owner-list" placeholder="e.g. Father / Brother / Aslam Goods" value={form.hiredParty}
                  onChange={(e) => set("hiredParty", e.target.value)} />
              </Field>
              <Field label={sharePct && autoPay ? `Amount to pay owner (Rs) — ${sharePct}% auto` : "Amount to pay owner (Rs) *"}>
                <input type="number" min={0} inputMode="numeric" className="field" value={form.hiredCost}
                  onChange={(e) => { setAutoPay(false); set("hiredCost", e.target.value); }} />
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg bg-soft p-2.5">
                <input type="checkbox" className="size-5 accent-brand" checked={form.hiredPaid} onChange={(e) => set("hiredPaid", e.target.checked)} />
                <span>Already paid owner</span>
              </label>
            </div>
          )}
        </div>

        <div className="my-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-3.5 py-3">
          <div className="text-[13px] text-muted">
            Fare {num(rent)} + Loading {num(ld)} + Detention {num(dt)} + Extra {num(extra)}
            {form.hired && (
              <div className="mt-1">
                Owner payment: <b className="text-bad">− {num(hiredCost)}</b> &nbsp;→&nbsp; Your trip profit:{" "}
                <b className={total - hiredCost < 0 ? "text-bad" : "text-ok"}>{rs(total - hiredCost)}</b>
              </div>
            )}
          </div>
          <div>Bill amount: <span className="text-2xl font-bold text-brand">{rs(total)}</span></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="success" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "✔ Update Trip" : "✔ Save Trip"}
          </Button>
          <Button variant="secondary" onClick={() => reset(false)}>Clear</Button>
          {editing && <Button variant="danger" onClick={() => reset(false)}>Cancel Edit</Button>}
        </div>
        <p className="mt-3 text-[13px] text-muted">Tip: after saving, the date, customer and vehicle stay filled in so the next trip is faster.</p>

        <datalist id="location-list">{locationList.map((l) => <option key={l} value={l} />)}</datalist>
        <datalist id="vehicle-list">{vehicleList.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="owner-list">{ownerList.map((o) => <option key={o} value={o} />)}</datalist>
        <datalist id="driver-list">{driverList.map((d) => <option key={d} value={d} />)}</datalist>
      </Card>

      <Card title={`Trips on ${fmtDate(form.date || today())}`}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <TripTable trips={dayTrips} customerName={api.customerName} onEdit={(id) => setEditingId(id)} onDelete={onDelete} showTotal={dayTrips.length > 0} />
        </div>
        {dayTrips.length > 0 && (
          <p className="mt-2 text-right font-semibold">Day Total: <span className="text-brand">{rs(dayTotal)}</span></p>
        )}
      </Card>
    </>
  );
}
