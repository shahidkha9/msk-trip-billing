"use client";

import { useMemo, useState } from "react";
import type { Expense } from "@/lib/types";
import { csvBlob, downloadBlob, fmtDate, formatVehicleNo, inRange, newId, num, rangeFor, rs, today, uniqueSorted, up, type RangePreset } from "@/lib/utils";
import { Button, Card, Field, Stat, grid } from "./ui";
import type { AppApi } from "./types";

interface Form {
  date: string;
  category: string;
  amount: string;
  paidTo: string;
  vehicleNo: string;
  notes: string;
}

export function ExpensesTab({ api }: { api: AppApi }) {
  const { settings, expenses } = api;
  const categories = settings.expenseCategories;
  const blank = (): Form => ({ date: today(), category: categories[0] ?? "Other", amount: "", paidTo: "", vehicleNo: "", notes: "" });
  const [form, setForm] = useState<Form>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor("thismonth"));
  const [catFilter, setCatFilter] = useState("");
  const [vehFilter, setVehFilter] = useState("");

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const list = useMemo(
    () =>
      expenses
        .filter((x) => inRange(x.date, from, to) && (!catFilter || x.category === catFilter) && (!vehFilter || x.vehicleNo.includes(up(vehFilter))))
        .sort((a, b) => (a.date === b.date ? (a.created || 0) - (b.created || 0) : a.date < b.date ? -1 : 1)),
    [expenses, from, to, catFilter, vehFilter],
  );
  const total = list.reduce((s, x) => s + x.amount, 0);
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of list) m[x.category] = (m[x.category] || 0) + x.amount;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const paidToList = useMemo(
    () => uniqueSorted([...api.vehicles.map((v) => v.driverName), ...expenses.map((x) => x.paidTo)]),
    [api.vehicles, expenses],
  );
  const vehicleList = useMemo(
    () => uniqueSorted([...api.vehicles.map((v) => v.vehicleNo), ...api.trips.map((t) => t.vehicleNo)]),
    [api.vehicles, api.trips],
  );


  const reset = () => { setForm(blank()); setEditingId(null); };

  const save = async () => {
    const amount = Number(form.amount) || 0;
    const missing: string[] = [];
    if (!form.date) missing.push("Date");
    if (!form.category) missing.push("Type");
    if (!amount) missing.push("Amount");
    if (missing.length) { alert("Please fill in: " + missing.join(", ")); return; }
    const old = editingId ? expenses.find((x) => x.id === editingId) : undefined;
    const exp: Expense = {
      id: old?.id ?? newId(),
      created: old?.created ?? Date.now(),
      date: form.date,
      category: form.category,
      amount,
      paidTo: form.paidTo.trim(),
      vehicleNo: formatVehicleNo(form.vehicleNo, true),
      notes: form.notes.trim(),
    };
    setSaving(true);
    if (await api.save("expenses", exp)) {
      api.toast(old ? "Expense updated ✔" : "Expense saved ✔");
      setForm({ ...blank(), date: form.date, category: form.category });
      setEditingId(null);
    }
    setSaving(false);
  };

  const edit = (x: Expense) => {
    setEditingId(x.id);
    setForm({ date: x.date, category: x.category, amount: String(x.amount), paidTo: x.paidTo, vehicleNo: x.vehicleNo, notes: x.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const del = async (x: Expense) => {
    if (!confirm(`Delete this expense?\n${fmtDate(x.date)}  ${x.category}  ${rs(x.amount)}`)) return;
    if (await api.remove("expenses", x.id)) { if (editingId === x.id) reset(); api.toast("Expense deleted"); }
  };

  const csv = () => {
    if (!list.length) { alert("No expenses found."); return; }
    const rows: unknown[][] = [
      ["Date", "Type", "Paid To", "Vehicle", "Amount", "Notes"],
      ...list.map((x) => [fmtDate(x.date), x.category, x.paidTo, x.vehicleNo, x.amount, x.notes]),
      ["", "", "", "TOTAL", total, ""],
    ];
    downloadBlob(csvBlob(rows), `Expenses_${from || "all"}_${to || ""}.csv`);
  };

  return (
    <>
      <Card title={editingId ? "Edit Expense" : "New Expense"}>
        <div className={grid}>
          <Field label="Date *">
            <input type="date" className="field" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Type *">
            <select className="field" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
              {form.category && !categories.includes(form.category) && <option>{form.category}</option>}
            </select>
          </Field>
          <Field label="Amount (Rs) *">
            <input type="number" min={0} inputMode="numeric" className="field" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <Field label="Paid To (driver / shop)">
            <input className="field" list="paidto-list" placeholder="e.g. Driver Akram" value={form.paidTo} onChange={(e) => set("paidTo", e.target.value)} />
          </Field>
          <Field label="Vehicle No. (optional)">
            <input className="field" list="vehicle-list" placeholder="abcd1234 → ABCD-1234" autoCapitalize="characters" autoComplete="off"
              value={form.vehicleNo} onChange={(e) => set("vehicleNo", formatVehicleNo(e.target.value))}
              onBlur={(e) => set("vehicleNo", formatVehicleNo(e.target.value, true))} />
          </Field>
          <Field label="Notes">
            <input className="field" placeholder="e.g. October salary, brake repair" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="success" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editingId ? "✔ Update Expense" : "✔ Save Expense"}
          </Button>
          <Button variant="secondary" onClick={reset}>Clear</Button>
        </div>
        <datalist id="paidto-list">{paidToList.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="vehicle-list">{vehicleList.map((v) => <option key={v} value={v} />)}</datalist>
      </Card>

      <Card title="Expense List">
        <div className={grid}>
          <Field label="From Date">
            <input type="date" className="field" value={from} onChange={(e) => setRange([e.target.value, to])} />
          </Field>
          <Field label="To Date">
            <input type="date" className="field" value={to} onChange={(e) => setRange([from, e.target.value])} />
          </Field>
          <Field label="Type">
            <select className="field" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All types</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Vehicle">
            <input className="field" list="vehicle-list" placeholder="All vehicles" autoCapitalize="characters" value={vehFilter}
              onChange={(e) => setVehFilter(formatVehicleNo(e.target.value))} />
          </Field>
        </div>
        <div className="mt-3 mb-3 flex flex-wrap gap-2">
          {(["thismonth", "lastmonth", "week", "all"] as RangePreset[]).map((r) => (
            <Button key={r} small variant="secondary" onClick={() => setRange(rangeFor(r))}>
              {{ thismonth: "This Month", lastmonth: "Last Month", week: "Last 7 Days", all: "All" }[r]}
            </Button>
          ))}
          <Button small variant="secondary" onClick={csv}>⬇ Excel (CSV)</Button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label={`Total Expenses (${list.length})`} value={rs(total)} highlight />
          {byCategory.slice(0, 3).map(([c, v]) => <Stat key={c} label={c} value={rs(v)} />)}
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          {list.length === 0 ? (
            <p className="p-4 text-[13px] text-muted">No expenses found.</p>
          ) : (
            <table className="w-full border-collapse text-[13.5px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead>
                <tr className="[&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
                  <th>#</th><th>Date</th><th>Type</th><th>Paid To</th><th>Vehicle</th><th>Notes</th><th className="text-right!">Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((x, i) => (
                  <tr key={x.id} className="hover:bg-[#fafcff] [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2">
                    <td>{i + 1}</td>
                    <td>{fmtDate(x.date)}</td>
                    <td><span className="rounded-md bg-soft px-1.5 py-0.5 text-xs">{x.category}</span></td>
                    <td>{x.paidTo}</td>
                    <td>{x.vehicleNo}</td>
                    <td>{x.notes}</td>
                    <td className="text-right font-bold">{num(x.amount)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <Button small variant="secondary" onClick={() => edit(x)}>Edit</Button>
                        <Button small variant="danger" onClick={() => del(x)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold [&_td]:px-2.5 [&_td]:py-2">
                  <td colSpan={6} className="text-right">Total</td>
                  <td className="text-right">{num(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}
