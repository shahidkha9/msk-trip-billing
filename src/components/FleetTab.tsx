"use client";

import { useMemo, useState } from "react";
import type { Expense, Ownership, Vehicle } from "@/lib/types";
import { formatVehicleNo, newId, num, rs, sumBy, today } from "@/lib/utils";
import { Button, Card, Field, Stat, grid } from "./ui";
import type { AppApi } from "./types";

interface VForm {
  vehicleNo: string;
  type: string;
  ownership: Ownership;
  ownerName: string;
  ownerPhone: string;
  ownerSharePercent: string;
  driverName: string;
  driverPhone: string;
  driverSalary: string;
  active: boolean;
  notes: string;
}

export function FleetTab({ api }: { api: AppApi }) {
  const { vehicles, settings, expenses } = api;
  const blank = (): VForm => ({
    vehicleNo: "", type: settings.vehicles[0] ?? "", ownership: "company", ownerName: "", ownerPhone: "", ownerSharePercent: "",
    driverName: "", driverPhone: "", driverSalary: "", active: true, notes: "",
  });
  const [form, setForm] = useState<VForm>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const set = <K extends keyof VForm>(k: K, v: VForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const list = useMemo(
    () => [...vehicles].filter((v) => showInactive || v.active).sort((a, b) => a.vehicleNo.localeCompare(b.vehicleNo)),
    [vehicles, showInactive],
  );
  const active = vehicles.filter((v) => v.active);
  const monthKey = today().slice(0, 7);
  const salaryPaidThisMonth = (v: Vehicle) =>
    expenses.some((x) => x.category === "Driver Salary" && x.date.startsWith(monthKey) &&
      x.paidTo.trim().toLowerCase() === v.driverName.trim().toLowerCase());

  const save = async () => {
    const vehicleNo = formatVehicleNo(form.vehicleNo, true);
    if (!vehicleNo) { alert("Please enter the vehicle number."); return; }
    if (vehicles.some((v) => v.id !== editingId && v.vehicleNo === vehicleNo)) { alert("This vehicle is already in your fleet."); return; }
    if (form.ownership === "owner" && !form.ownerName.trim()) { alert("Please enter the owner's name."); return; }
    const old = editingId ? vehicles.find((v) => v.id === editingId) : undefined;
    const v: Vehicle = {
      id: old?.id ?? newId(), created: old?.created ?? Date.now(), vehicleNo, type: form.type, ownership: form.ownership,
      ownerName: form.ownership === "owner" ? form.ownerName.trim() : "", ownerPhone: form.ownership === "owner" ? form.ownerPhone.trim() : "",
      ownerSharePercent: form.ownership === "owner" ? Math.min(100, Number(form.ownerSharePercent) || 0) : 0,
      driverName: form.driverName.trim(), driverPhone: form.driverPhone.trim(), driverSalary: Number(form.driverSalary) || 0,
      active: form.active, notes: form.notes.trim(),
    };
    setBusy(true);
    if (await api.save("vehicles", v)) {
      api.toast(old ? "Vehicle updated ✔" : "Vehicle added ✔");
      setForm(blank());
      setEditingId(null);
    }
    setBusy(false);
  };
  const edit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      vehicleNo: v.vehicleNo, type: v.type, ownership: v.ownership, ownerName: v.ownerName, ownerPhone: v.ownerPhone,
      ownerSharePercent: v.ownerSharePercent ? String(v.ownerSharePercent) : "", driverName: v.driverName, driverPhone: v.driverPhone,
      driverSalary: v.driverSalary ? String(v.driverSalary) : "", active: v.active, notes: v.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const del = async (v: Vehicle) => {
    if (!confirm(`Remove ${v.vehicleNo} from your fleet?\n(Old trips and expenses are kept. Tip: you can also mark it "Not in use" instead.)`)) return;
    if (await api.remove("vehicles", v.id)) api.toast("Vehicle removed");
  };
  const paySalary = async (v: Vehicle) => {
    if (!v.driverName.trim() || !v.driverSalary) { alert("Set the driver's name and monthly salary first (Edit)."); return; }
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    if (!confirm(`Record salary for ${v.driverName}?\n${rs(v.driverSalary)} — ${month}\n(It will be added to Expenses.)`)) return;
    const x: Expense = {
      id: newId(), created: Date.now(), date: today(), category: "Driver Salary", amount: v.driverSalary,
      paidTo: v.driverName, vehicleNo: v.vehicleNo, notes: `Salary ${month}`,
    };
    if (await api.save("expenses", x)) api.toast(`Salary ${rs(v.driverSalary)} recorded ✔`);
  };

  return (
    <>
      <Card title={editingId ? "Edit Vehicle" : "Add Vehicle"}>
        <div className={grid}>
          <Field label="Vehicle No. *">
            <input className="field" placeholder="abcd1234 → ABCD-1234" autoCapitalize="characters" autoComplete="off" value={form.vehicleNo}
              onChange={(e) => set("vehicleNo", formatVehicleNo(e.target.value))} onBlur={(e) => set("vehicleNo", formatVehicleNo(e.target.value, true))} />
          </Field>
          <Field label="Vehicle Type">
            <select className="field" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {settings.vehicles.map((t) => <option key={t}>{t}</option>)}
              {form.type && !settings.vehicles.includes(form.type) && <option>{form.type}</option>}
            </select>
          </Field>
          <Field label="Driver name">
            <input className="field" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} />
          </Field>
          <Field label="Driver phone">
            <input className="field" inputMode="tel" value={form.driverPhone} onChange={(e) => set("driverPhone", e.target.value)} />
          </Field>
          <Field label="Driver monthly salary (Rs)">
            <input type="number" min={0} inputMode="numeric" className="field" value={form.driverSalary} onChange={(e) => set("driverSalary", e.target.value)} />
          </Field>
          <Field label="Notes">
            <input className="field" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. token due March" />
          </Field>
        </div>

        <div className="mt-3 rounded-xl border border-line p-3">
          <div className="mb-2 text-[13px] text-muted">Who owns this vehicle?</div>
          <div className="flex flex-wrap gap-2">
            {([["company", "🚚 Me (my own vehicle)"], ["owner", "🤝 Someone else — I pay them per trip"]] as [Ownership, string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => set("ownership", v)}
                className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm ${form.ownership === v ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {form.ownership === "owner" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Owner name *">
                <input className="field" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="e.g. Father / Brother" />
              </Field>
              <Field label="Owner phone">
                <input className="field" inputMode="tel" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} />
              </Field>
              <Field label="Owner's share of each trip (%) — blank = type each time">
                <input type="number" min={0} max={100} className="field" value={form.ownerSharePercent}
                  onChange={(e) => set("ownerSharePercent", e.target.value)} placeholder="e.g. 85" />
              </Field>
            </div>
          )}
        </div>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-5 accent-brand" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
          <span>In use</span>
        </label>
        <div className="mt-3 flex gap-2">
          <Button variant="success" onClick={save} disabled={busy}>{editingId ? "✔ Update Vehicle" : "✔ Add Vehicle"}</Button>
          {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setForm(blank()); }}>Cancel</Button>}
        </div>
      </Card>

      <Card title="Your Fleet">
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Vehicles in use" value={String(active.length)} />
          <Stat label="Your own" value={String(active.filter((v) => v.ownership === "company").length)} />
          <Stat label="Other owners" value={String(active.filter((v) => v.ownership === "owner").length)} />
          <Stat label="Monthly driver salaries" value={rs(sumBy(active, (v) => v.driverSalary))} highlight />
        </div>
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show vehicles not in use
        </label>
        <div className="overflow-x-auto rounded-xl border border-line">
          {list.length === 0 ? (
            <p className="p-4 text-[13px] text-muted">No vehicles yet. Add your vehicles above — then their driver and owner fill in automatically on each trip.</p>
          ) : (
            <table className="w-full border-collapse text-[13.5px] [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
              <thead>
                <tr><th>Vehicle</th><th>Type</th><th>Owner</th><th>Driver</th><th>Driver phone</th><th className="text-right!">Salary</th><th>This month</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} className={v.active ? "" : "opacity-50"}>
                    <td className="font-semibold">{v.vehicleNo}{!v.active && " (not in use)"}</td>
                    <td>{v.type}</td>
                    <td>{v.ownership === "owner" ? <>{v.ownerName}{v.ownerSharePercent ? <span className="text-muted"> · {v.ownerSharePercent}%</span> : null}</> : <span className="text-muted">Me</span>}</td>
                    <td>{v.driverName}</td>
                    <td>{v.driverPhone}</td>
                    <td className="text-right">{v.driverSalary ? num(v.driverSalary) : "-"}</td>
                    <td>
                      {v.driverSalary > 0 && (salaryPaidThisMonth(v)
                        ? <span className="rounded-md bg-[#e8f6f0] px-2 py-0.5 text-xs font-semibold text-ok">Salary paid</span>
                        : <Button small variant="success" onClick={() => paySalary(v)}>Pay salary</Button>)}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <Button small variant="secondary" onClick={() => edit(v)}>Edit</Button>
                        <Button small variant="danger" onClick={() => del(v)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">Per-vehicle and per-driver profit is in <b>📊 Reports</b>.</p>
      </Card>
    </>
  );
}
