"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trip } from "@/lib/types";
import { formatVehicleNo, isBase, newId, num, otherParty, rs, sortTrips, today, tripTotal, up, fmtDate } from "@/lib/utils";
import { Button, Card, Field, grid } from "./ui";
import { TripTable } from "./TripTable";
import type { AppApi } from "./types";

interface Form {
  date: string;
  slipNo: string;
  biltyNo: string;
  vehicleNo: string;
  vehicleType: string;
  from: string;
  to: string;
  route: string;
  qty: string;
  rent: string;
  extra: string;
  loading: boolean;
  detention: boolean;
  notes: string;
}

const emptyForm = (vehicleType: string): Form => ({
  date: today(), slipNo: "", biltyNo: "", vehicleNo: "", vehicleType, from: "", to: "", route: "",
  qty: "", rent: "", extra: "", loading: false, detention: false, notes: "",
});

interface Props {
  api: AppApi;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function EntryTab({ api, editingId, setEditingId, onDelete }: Props) {
  const { settings, trips } = api;
  const [form, setForm] = useState<Form>(() => emptyForm(settings.vehicles[0] ?? ""));
  const [saving, setSaving] = useState(false);
  const editing = editingId ? trips.find((t) => t.id === editingId) ?? null : null;

  // When "Edit" is clicked somewhere, load that trip into the form.
  useEffect(() => {
    if (!editing) return;
    setForm({
      date: editing.date, slipNo: editing.slipNo, biltyNo: editing.biltyNo, vehicleNo: editing.vehicleNo,
      vehicleType: editing.vehicleType, from: editing.from, to: editing.to, route: editing.route, qty: editing.qty,
      rent: String(editing.rent || ""), extra: editing.extra ? String(editing.extra) : "",
      loading: editing.loading, detention: editing.detention, notes: editing.notes,
    });
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Looks up the fare for a route + vehicle type in the rate card. */
  const fareFor = (route: string, vehicleType: string) => {
    const r = settings.routes[route];
    return r && r[vehicleType] != null ? String(r[vehicleType]) : null;
  };

  const changeRoute = (route: string) =>
    setForm((f) => ({ ...f, route, rent: fareFor(route, f.vehicleType) ?? f.rent }));
  const changeVehicleType = (vehicleType: string) =>
    setForm((f) => ({ ...f, vehicleType, rent: f.route ? fareFor(f.route, vehicleType) ?? f.rent : f.rent }));

  /** If the mill/godown already has a route, fill in route + fare automatically. */
  const autoRoute = (from: string, to: string) => {
    const route = settings.locations[otherParty(from, to)];
    if (route && settings.routes[route]) changeRoute(route);
  };
  const changeLocation = (k: "from" | "to", value: string) => {
    const next = { ...form, [k]: value };
    setForm(next);
    if (up(value) in settings.locations) autoRoute(next.from, next.to);
  };

  const reset = (keep: boolean) => {
    const base = emptyForm(keep ? form.vehicleType : settings.vehicles[0] ?? "");
    if (keep) { base.date = form.date; base.vehicleNo = form.vehicleNo; }
    setForm(base);
    setEditingId(null);
  };

  const save = async () => {
    const vehicleNo = formatVehicleNo(form.vehicleNo, true);
    const missing: string[] = [];
    if (!form.date) missing.push("Date");
    if (!vehicleNo) missing.push("Vehicle No.");
    if (!form.from.trim()) missing.push("From");
    if (!form.to.trim()) missing.push("To");
    if (!form.route) missing.push("Route");
    if (!rent) missing.push("Fare");
    if (missing.length) { alert("Please fill in: " + missing.join(", ")); return; }
    const slip = form.slipNo.trim();
    if (!editing && slip && trips.some((t) => t.slipNo === slip) && !confirm(`Slip No. ${slip} already exists. Save anyway?`)) return;

    const trip: Trip = {
      id: editing?.id ?? newId(),
      created: editing?.created ?? Date.now(),
      date: form.date, slipNo: slip, biltyNo: form.biltyNo.trim(), vehicleNo, vehicleType: form.vehicleType,
      from: up(form.from), to: up(form.to), route: form.route, qty: form.qty.trim(), rent, extra,
      loading: form.loading, loadAmt: form.loading ? loadAmt : 0,
      detention: form.detention, detentionAmt: form.detention ? detentionAmt : 0,
      notes: form.notes.trim(),
    };

    setSaving(true);
    const ok = await api.saveTrip(trip);
    if (ok) {
      // Remember new locations and their route for next time.
      const locations = { ...settings.locations };
      let changed = false;
      for (const l of [trip.from, trip.to]) if (!(l in locations)) { locations[l] = ""; changed = true; }
      const p = otherParty(trip.from, trip.to);
      if (p && !isBase(p) && !locations[p]) { locations[p] = trip.route; changed = true; }
      if (changed) await api.updateSettings({ ...settings, locations });
      api.toast(editing ? "Entry updated ✔" : "Entry saved ✔");
      reset(true);
    }
    setSaving(false);
  };

  const dayTrips = useMemo(() => sortTrips(trips.filter((t) => t.date === (form.date || today()))), [trips, form.date]);
  const dayTotal = dayTrips.reduce((s, t) => s + tripTotal(t), 0);
  const locationList = useMemo(() => Object.keys(settings.locations).sort(), [settings.locations]);
  const vehicleList = useMemo(() => [...new Set(trips.map((t) => t.vehicleNo).filter(Boolean))].sort(), [trips]);

  return (
    <>
      <Card title={editing ? "Edit Entry" : "New Trip Entry"}>
        <div className={grid}>
          <Field label="Date *">
            <input type="date" className="field" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Slip No. (S.No)">
            <input className="field" placeholder="e.g. 4843" value={form.slipNo} onChange={(e) => set("slipNo", e.target.value)} />
          </Field>
          <Field label="Bilty No.">
            <input className="field" placeholder="optional" value={form.biltyNo} onChange={(e) => set("biltyNo", e.target.value)} />
          </Field>
          <Field label="Vehicle No. *">
            <input
              className="field" list="vehicle-list" placeholder="abcd1234 → ABCD-1234" autoCapitalize="characters" autoComplete="off"
              value={form.vehicleNo}
              onChange={(e) => set("vehicleNo", formatVehicleNo(e.target.value))}
              onBlur={(e) => set("vehicleNo", formatVehicleNo(e.target.value, true))}
            />
          </Field>
          <Field label="Vehicle Type *">
            <select className="field" value={form.vehicleType} onChange={(e) => changeVehicleType(e.target.value)}>
              {settings.vehicles.map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="From *">
            <input
              className="field" list="location-list" placeholder="e.g. GULAHMED TEXTILE" value={form.from}
              onChange={(e) => changeLocation("from", e.target.value)} onBlur={() => autoRoute(form.from, form.to)}
            />
          </Field>
          <Field label="To *">
            <input
              className="field" list="location-list" placeholder="e.g. YTM-07" value={form.to}
              onChange={(e) => changeLocation("to", e.target.value)} onBlur={() => autoRoute(form.from, form.to)}
            />
          </Field>
          <Field label="Route (Rate Area) *">
            <select className="field" value={form.route} onChange={(e) => changeRoute(e.target.value)}>
              <option value="">-- Select Route --</option>
              {Object.keys(settings.routes).map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Quantity (Bags/Ctns)">
            <input className="field" placeholder="e.g. 115 Bags" value={form.qty} onChange={(e) => set("qty", e.target.value)} />
          </Field>
          <Field label="Fare (Rs) — auto">
            <input type="number" min={0} inputMode="numeric" className="field" value={form.rent} onChange={(e) => set("rent", e.target.value)} />
          </Field>
          <Field label="Extra Charges (Rs)">
            <input type="number" min={0} inputMode="numeric" placeholder="0" className="field" value={form.extra} onChange={(e) => set("extra", e.target.value)} />
          </Field>
          <Field label="Notes">
            <input className="field" placeholder="Brand / Lot / remarks" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-soft p-2.5">
            <input type="checkbox" className="size-5 accent-brand" checked={form.loading} onChange={(e) => set("loading", e.target.checked)} />
            <span>Add Loading / Unloading charge (+ Rs {num(loadAmt)})</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-soft p-2.5">
            <input type="checkbox" className="size-5 accent-brand" checked={form.detention} onChange={(e) => set("detention", e.target.checked)} />
            <span>Add Detention charge (+ Rs {num(detentionAmt)})</span>
          </label>
        </div>

        <div className="my-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-3.5 py-3">
          <div className="text-[13px] text-muted">
            Fare {num(rent)} + Loading {num(ld)} + Detention {num(dt)} + Extra {num(extra)}
          </div>
          <div>
            Trip Total: <span className="text-2xl font-bold text-brand">{rs(total)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="success" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "✔ Update Entry" : "✔ Save Entry"}
          </Button>
          <Button variant="secondary" onClick={() => reset(false)}>Clear</Button>
          {editing && <Button variant="danger" onClick={() => reset(false)}>Cancel Edit</Button>}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Tip: After saving, Date, Vehicle No. and Vehicle Type stay filled in, so your next entry is faster.
        </p>

        <datalist id="location-list">{locationList.map((l) => <option key={l} value={l} />)}</datalist>
        <datalist id="vehicle-list">{vehicleList.map((v) => <option key={v} value={v} />)}</datalist>
      </Card>

      <Card title={`Entries for ${fmtDate(form.date || today())}`}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <TripTable trips={dayTrips} onEdit={(id) => setEditingId(id)} onDelete={onDelete} showTotal={dayTrips.length > 0} />
        </div>
        {dayTrips.length > 0 && (
          <p className="mt-2 text-right font-semibold">
            Day Total: <span className="text-brand">{rs(dayTotal)}</span>
          </p>
        )}
      </Card>
    </>
  );
}
