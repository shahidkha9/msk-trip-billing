"use client";

import { useState } from "react";
import { COMMON_VEHICLE_TYPES, cloneSettings, DEFAULT_SETTINGS } from "@/lib/defaults";
import { PRODUCT_NAME } from "@/lib/brand";
import type { Customer, Profile, RateCard, Settings } from "@/lib/types";
import { newId, up } from "@/lib/utils";
import { Button, Card, Field } from "./ui";

interface Props {
  profile: Profile | null;
  onFinish: (settings: Settings, firstCustomer: Customer | null) => Promise<boolean>;
}

/** 3-step setup for a new account: business → vehicles & charges → customer & rates. */
export function SetupWizard({ profile, onFinish }: Props) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [biz, setBiz] = useState({ name: profile?.businessName ?? "", phone: profile?.phone ?? "", address: "" });
  const [types, setTypes] = useState<string[]>(["Shehzore", "Mazda 14 ft", "Mazda 17 ft", "Mazda 20 ft"]);
  const [customType, setCustomType] = useState("");
  const [loadCharge, setLoadCharge] = useState("500");
  const [detention, setDetention] = useState("2500");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [bases, setBases] = useState("");
  const [routes, setRoutes] = useState<RateCard>({});
  const [newRoute, setNewRoute] = useState("");

  const allTypes = [...COMMON_VEHICLE_TYPES, ...types.filter((t) => !COMMON_VEHICLE_TYPES.includes(t))];
  const toggleType = (t: string) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const addType = () => {
    const t = customType.trim();
    if (t && !types.includes(t)) setTypes([...types, t]);
    setCustomType("");
  };
  const addRoute = () => {
    const r = newRoute.trim();
    if (!r || routes[r]) return;
    setRoutes({ ...routes, [r]: Object.fromEntries(types.map((t) => [t, 0])) });
    setNewRoute("");
  };

  const next = () => {
    if (step === 1 && !biz.name.trim()) { alert("Please enter your business name."); return; }
    if (step === 2 && types.length === 0) { alert("Please choose at least one vehicle type."); return; }
    setStep(step + 1);
  };

  const finish = async () => {
    const s = cloneSettings(DEFAULT_SETTINGS);
    s.businessName = biz.name.trim();
    s.phone = biz.phone.trim();
    s.address = biz.address.trim();
    s.vehicles = types;
    s.loadCharge = Number(loadCharge) || 0;
    s.detentionCharge = Number(detention) || 0;
    s.routes = routes;
    s.baseLocations = bases.split(",").map(up).filter(Boolean);
    for (const b of s.baseLocations) s.locations[b] = "";
    s.setupDone = true;
    const c: Customer | null = customer.name.trim()
      ? { id: newId(), name: customer.name.trim(), phone: customer.phone.trim(), address: customer.address.trim(), notes: "", created: Date.now() }
      : null;
    setBusy(true);
    await onFinish(s, c);
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-brand">Welcome to {PRODUCT_NAME} 👋</h1>
        <p className="text-sm text-muted">Let&apos;s set up your account — takes 2 minutes. You can change everything later in Settings.</p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-2 w-16 rounded-full ${n <= step ? "bg-brand" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card title="Step 1 of 3 — Your business">
          <p className="mb-3 text-[13px] text-muted">This appears at the top of every bill you send.</p>
          <div className="space-y-3">
            <Field label="Business name *">
              <input className="field" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="e.g. Ali Goods Transport" />
            </Field>
            <Field label="Phone">
              <input className="field" inputMode="tel" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className="field" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} placeholder="e.g. Shop 5, Truck Stand, Karachi" />
            </Field>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 2 of 3 — Vehicles & charges">
          <p className="mb-2 text-[13px] text-muted">Which types of vehicles do you run? (Tick all that apply.)</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {allTypes.map((t) => (
              <button key={t} type="button" onClick={() => toggleType(t)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${types.includes(t) ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                {types.includes(t) ? "✔ " : ""}{t}
              </button>
            ))}
          </div>
          <div className="mb-4 flex gap-2">
            <input className="field max-w-60" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Other type…" />
            <Button variant="secondary" onClick={addType}>+ Add</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loading / Unloading charge per trip (Rs) — 0 if you don't charge">
              <input type="number" min={0} className="field" value={loadCharge} onChange={(e) => setLoadCharge(e.target.value)} />
            </Field>
            <Field label="Detention charge per trip (Rs) — 0 if you don't charge">
              <input type="number" min={0} className="field" value={detention} onChange={(e) => setDetention(e.target.value)} />
            </Field>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Step 3 of 3 — First customer & rates (optional)">
          <p className="mb-2 text-[13px] font-semibold">Your main customer (the company you send bills to)</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Field label="Company name">
              <input className="field" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="e.g. ABC Textile Mills" />
            </Field>
            <Field label="Phone">
              <input className="field" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className="field" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            </Field>
          </div>

          <p className="mb-1 text-[13px] font-semibold">Your own godowns / mills (optional)</p>
          <p className="mb-2 text-[12px] text-muted">
            When a trip starts or ends here, the fare is taken from the OTHER place. Separate with commas.
          </p>
          <input className="field mb-4" value={bases} onChange={(e) => setBases(e.target.value)} placeholder="e.g. MILL-01, MILL-07" />

          <p className="mb-1 text-[13px] font-semibold">Fixed rates per area (optional)</p>
          <p className="mb-2 text-[12px] text-muted">Add the areas you go to and the fare for each vehicle type. The fare then fills in automatically.</p>
          <div className="mb-2 flex gap-2">
            <input className="field max-w-60" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} placeholder="Area name, e.g. Korangi" />
            <Button variant="secondary" onClick={addRoute}>+ Add Area</Button>
          </div>
          {Object.keys(routes).length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#f7f9fc]">
                    <th className="px-2 py-2 text-left">Area</th>
                    {types.map((t) => <th key={t} className="whitespace-nowrap px-2 py-2 text-right">{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(routes).map((r) => (
                    <tr key={r} className="border-t border-line">
                      <td className="px-2 py-1.5 font-semibold">{r}</td>
                      {types.map((t) => (
                        <td key={t} className="px-1 py-1">
                          <input type="number" min={0} className="field min-w-20 text-right" value={routes[r][t] || ""}
                            onChange={(e) => setRoutes({ ...routes, [r]: { ...routes[r], [t]: Number(e.target.value) || 0 } })} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>← Back</Button> : <span />}
        {step < 3 ? (
          <Button onClick={next}>Next →</Button>
        ) : (
          <Button variant="success" onClick={finish} disabled={busy}>{busy ? "Saving…" : "✔ Finish Setup"}</Button>
        )}
      </div>
    </div>
  );
}
