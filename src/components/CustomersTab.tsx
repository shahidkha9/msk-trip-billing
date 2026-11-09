"use client";

import { useMemo, useState } from "react";
import { customerBalances } from "@/lib/reports";
import type { Customer, Receipt } from "@/lib/types";
import { csvBlob, downloadBlob, fmtDate, newId, num, rs, sumBy, today, tripTotal } from "@/lib/utils";
import { Button, Card, Field, Stat, grid } from "./ui";
import type { AppApi } from "./types";

const METHODS = ["Cash", "Cheque", "Bank Transfer", "JazzCash / Easypaisa", "Other"];
type CForm = { name: string; phone: string; address: string; notes: string };
const blankC: CForm = { name: "", phone: "", address: "", notes: "" };

export function CustomersTab({ api }: { api: AppApi }) {
  const { customers, trips, receipts } = api;
  const [cForm, setCForm] = useState<CForm>(blankC);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rForm, setRForm] = useState({ date: today(), amount: "", method: "Cash", reference: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const balances = useMemo(() => customerBalances(customers, trips, receipts), [customers, trips, receipts]);
  const totals = {
    billed: sumBy(balances, (b) => b.billed),
    received: sumBy(balances, (b) => b.received),
    balance: sumBy(balances, (b) => b.balance),
  };
  const open = customers.find((c) => c.id === openId) ?? null;

  /* ---------- add / edit customer ---------- */
  const saveCustomer = async () => {
    const name = cForm.name.trim();
    if (!name) { alert("Please enter the customer name."); return; }
    if (customers.some((c) => c.id !== editingId && c.name.toLowerCase() === name.toLowerCase())) { alert("This customer already exists."); return; }
    const old = editingId ? customers.find((c) => c.id === editingId) : undefined;
    const c: Customer = {
      id: old?.id ?? newId(), created: old?.created ?? Date.now(),
      name, phone: cForm.phone.trim(), address: cForm.address.trim(), notes: cForm.notes.trim(),
    };
    setBusy(true);
    if (await api.save("customers", c)) {
      api.toast(old ? "Customer updated ✔" : "Customer added ✔");
      setCForm(blankC);
      setEditingId(null);
    }
    setBusy(false);
  };
  const edit = (c: Customer) => {
    setEditingId(c.id);
    setCForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const del = async (c: Customer) => {
    const used = trips.some((t) => t.customerId === c.id) || receipts.some((r) => r.customerId === c.id);
    if (used) { alert(`"${c.name}" has trips or payments, so it cannot be deleted.`); return; }
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    if (await api.remove("customers", c.id)) api.toast("Customer deleted");
  };

  /* ---------- statement for one customer ---------- */
  const ledger = useMemo(() => {
    if (!open) return [];
    type Row = { date: string; created: number; desc: string; debit: number; credit: number; receipt?: Receipt };
    const rows: Row[] = [
      ...trips.filter((t) => t.customerId === open.id).map((t) => ({
        date: t.date, created: t.created, debit: tripTotal(t), credit: 0,
        desc: `Trip ${t.slipNo ? "#" + t.slipNo + " " : ""}${t.vehicleNo} ${t.from} → ${t.to}`,
      })),
      ...receipts.filter((r) => r.customerId === open.id).map((r) => ({
        date: r.date, created: r.created, debit: 0, credit: r.amount, receipt: r,
        desc: `Payment received — ${r.method}${r.reference ? " " + r.reference : ""}${r.notes ? " (" + r.notes + ")" : ""}`,
      })),
    ].sort((a, b) => (a.date === b.date ? a.created - b.created : a.date < b.date ? -1 : 1));
    let bal = 0;
    return rows.map((r) => ({ ...r, balance: (bal += r.debit - r.credit) }));
  }, [open, trips, receipts]);
  const openBal = ledger.length ? ledger[ledger.length - 1].balance : 0;

  const receive = async () => {
    if (!open) return;
    const amount = Number(rForm.amount) || 0;
    if (!amount) { alert("Please enter the amount received."); return; }
    if (!rForm.date) { alert("Please enter the date."); return; }
    const r: Receipt = {
      id: newId(), created: Date.now(), date: rForm.date, customerId: open.id, amount,
      method: rForm.method, reference: rForm.reference.trim(), notes: rForm.notes.trim(),
    };
    setBusy(true);
    if (await api.save("receipts", r)) {
      api.toast(`Payment ${rs(amount)} from ${open.name} saved ✔`);
      setRForm({ date: today(), amount: "", method: rForm.method, reference: "", notes: "" });
    }
    setBusy(false);
  };
  const delReceipt = async (r: Receipt) => {
    if (!confirm(`Delete this payment of ${rs(r.amount)} (${fmtDate(r.date)})?`)) return;
    if (await api.remove("receipts", r.id)) api.toast("Payment deleted");
  };
  const statementCsv = () => {
    if (!open) return;
    downloadBlob(
      csvBlob([
        [`Statement: ${open.name}`],
        ["Date", "Details", "Bill (Rs)", "Received (Rs)", "Balance (Rs)"],
        ...ledger.map((r) => [fmtDate(r.date), r.desc, r.debit || "", r.credit || "", r.balance]),
      ]),
      `Statement_${open.name.replace(/[^\w-]+/g, "_")}.csv`,
    );
  };

  return (
    <>
      <Card title={editingId ? "Edit Customer" : "Add Customer"}>
        <div className={grid}>
          <Field label="Company name *">
            <input className="field" value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} placeholder="e.g. ABC Textile Mills" />
          </Field>
          <Field label="Phone">
            <input className="field" value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} />
          </Field>
          <Field label="Address (shown on bill)">
            <input className="field" value={cForm.address} onChange={(e) => setCForm({ ...cForm, address: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className="field" value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} placeholder="e.g. contact person" />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="success" onClick={saveCustomer} disabled={busy}>{editingId ? "✔ Update Customer" : "✔ Add Customer"}</Button>
          {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setCForm(blankC); }}>Cancel</Button>}
        </div>
      </Card>

      <Card title="Customers — what they owe you">
        <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Stat label="Total billed (all time)" value={rs(totals.billed)} />
          <Stat label="Total received" value={rs(totals.received)} />
          <Stat label="Still to receive" value={rs(totals.balance)} highlight />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          {balances.length === 0 ? (
            <p className="p-4 text-[13px] text-muted">No customers yet. Add your first customer above.</p>
          ) : (
            <table className="w-full border-collapse text-[13.5px] [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
              <thead>
                <tr><th>Customer</th><th>Phone</th><th>Trips</th><th className="text-right!">Billed</th><th className="text-right!">Received</th><th className="text-right!">Balance</th><th>Last trip</th><th></th></tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.customer.id} className={openId === b.customer.id ? "bg-soft" : "hover:bg-[#fafcff]"}>
                    <td className="font-semibold">{b.customer.name}</td>
                    <td>{b.customer.phone}</td>
                    <td>{b.trips}</td>
                    <td className="text-right">{num(b.billed)}</td>
                    <td className="text-right">{num(b.received)}</td>
                    <td className={`text-right font-bold ${b.balance > 0 ? "text-bad" : "text-ok"}`}>{num(b.balance)}</td>
                    <td>{fmtDate(b.lastTrip)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <Button small onClick={() => setOpenId(openId === b.customer.id ? null : b.customer.id)}>
                          {openId === b.customer.id ? "Close" : "Open"}
                        </Button>
                        <Button small variant="secondary" onClick={() => edit(b.customer)}>Edit</Button>
                        <Button small variant="danger" onClick={() => del(b.customer)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {open && (
        <Card title={`${open.name} — Statement`}>
          <div className={`mb-4 rounded-xl px-4 py-3 ${openBal > 0 ? "bg-[#fdecea]" : "bg-[#e8f6f0]"}`}>
            <div className="text-[13px]">{openBal > 0 ? "They still owe you" : openBal < 0 ? "Advance received" : "All settled"}</div>
            <div className={`text-2xl font-bold ${openBal > 0 ? "text-bad" : "text-ok"}`}>{rs(Math.abs(openBal))}</div>
          </div>

          <p className="mb-2 font-semibold">Record a payment received</p>
          <div className={grid}>
            <Field label="Date *">
              <input type="date" className="field" value={rForm.date} onChange={(e) => setRForm({ ...rForm, date: e.target.value })} />
            </Field>
            <Field label="Amount (Rs) *">
              <input type="number" min={0} inputMode="numeric" className="field" value={rForm.amount} onChange={(e) => setRForm({ ...rForm, amount: e.target.value })} />
            </Field>
            <Field label="Method">
              <select className="field" value={rForm.method} onChange={(e) => setRForm({ ...rForm, method: e.target.value })}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Cheque / Ref no.">
              <input className="field" value={rForm.reference} onChange={(e) => setRForm({ ...rForm, reference: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3 mb-5 flex flex-wrap gap-2">
            <Button variant="success" onClick={receive} disabled={busy}>✔ Save Payment</Button>
            <Button variant="secondary" onClick={statementCsv}>⬇ Statement (Excel)</Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            {ledger.length === 0 ? (
              <p className="p-4 text-[13px] text-muted">No trips or payments yet.</p>
            ) : (
              <table className="w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-[#f7f9fc] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left">
                <thead>
                  <tr><th>Date</th><th>Details</th><th className="text-right!">Bill</th><th className="text-right!">Received</th><th className="text-right!">Balance</th><th></th></tr>
                </thead>
                <tbody>
                  {ledger.map((r, i) => (
                    <tr key={i} className={r.credit ? "bg-[#f3fbf7]" : ""}>
                      <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td>{r.desc}</td>
                      <td className="text-right">{r.debit ? num(r.debit) : ""}</td>
                      <td className="text-right text-ok">{r.credit ? num(r.credit) : ""}</td>
                      <td className="text-right font-semibold">{num(r.balance)}</td>
                      <td>{r.receipt && <Button small variant="danger" onClick={() => delReceipt(r.receipt!)}>Del</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
