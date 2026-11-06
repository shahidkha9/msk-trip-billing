"use client";

import { useState } from "react";
import type { RateCard } from "@/lib/types";
import { isBase, up } from "@/lib/utils";
import { Button, Card, Field, grid } from "./ui";
import type { AppApi } from "./types";

export function SettingsTab({ api }: { api: AppApi }) {
  const { settings } = api;
  const [info, setInfo] = useState({
    businessName: settings.businessName,
    phone: settings.phone,
    billTo: settings.billTo,
    loadCharge: String(settings.loadCharge),
    detentionCharge: String(settings.detentionCharge),
  });
  const [rates, setRates] = useState<RateCard>(() => JSON.parse(JSON.stringify(settings.routes)));
  const [newRoute, setNewRoute] = useState("");
  const [newLoc, setNewLoc] = useState("");

  const saveInfo = async () => {
    const ok = await api.updateSettings({
      ...settings,
      businessName: info.businessName.trim() || "MSK Transport Service",
      phone: info.phone.trim(),
      billTo: info.billTo.trim(),
      loadCharge: Number(info.loadCharge) || 0,
      detentionCharge: Number(info.detentionCharge) || 0,
    });
    if (ok) api.toast("Saved ✔");
  };

  const saveRates = async () => {
    if (await api.updateSettings({ ...settings, routes: rates })) api.toast("Rates saved ✔");
  };

  const addRoute = async () => {
    const n = newRoute.trim();
    if (!n) return;
    if (settings.routes[n]) { alert("This route already exists"); return; }
    const row = Object.fromEntries(settings.vehicles.map((v) => [v, 0]));
    const routes = { ...rates, [n]: row };
    if (await api.updateSettings({ ...settings, routes })) {
      setRates(routes);
      setNewRoute("");
      api.toast("Route added — enter its rates, then click Save Rates");
    }
  };

  const deleteRoute = async (r: string) => {
    if (!confirm(`Delete route "${r}"?`)) return;
    const routes = { ...rates };
    delete routes[r];
    const locations = Object.fromEntries(Object.entries(settings.locations).map(([l, v]) => [l, v === r ? "" : v]));
    if (await api.updateSettings({ ...settings, routes, locations })) { setRates(routes); api.toast("Route deleted"); }
  };

  const setLocationRoute = async (loc: string, route: string) => {
    if (await api.updateSettings({ ...settings, locations: { ...settings.locations, [loc]: route } })) api.toast("Saved ✔");
  };
  const addLocation = async () => {
    const n = up(newLoc);
    if (!n) return;
    if (!(n in settings.locations)) await api.updateSettings({ ...settings, locations: { ...settings.locations, [n]: "" } });
    setNewLoc("");
  };
  const deleteLocation = async (loc: string) => {
    if (!confirm(`Delete location "${loc}"?`)) return;
    const locations = { ...settings.locations };
    delete locations[loc];
    await api.updateSettings({ ...settings, locations });
  };

  const routeNames = Object.keys(settings.routes);

  return (
    <>
      <Card title="Bill Details & Charges">
        <div className={grid}>
          <Field label="Business Name (shown on bill)">
            <input className="field" value={info.businessName} onChange={(e) => setInfo({ ...info, businessName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="field" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
          </Field>
          <Field label="Bill To (Company)">
            <input className="field" value={info.billTo} onChange={(e) => setInfo({ ...info, billTo: e.target.value })} />
          </Field>
          <Field label="Loading/Unloading Charge (Rs per trip)">
            <input type="number" min={0} className="field" value={info.loadCharge} onChange={(e) => setInfo({ ...info, loadCharge: e.target.value })} />
          </Field>
          <Field label="Detention Charge (Rs per trip)">
            <input type="number" min={0} className="field" value={info.detentionCharge} onChange={(e) => setInfo({ ...info, detentionCharge: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3">
          <Button variant="success" onClick={saveInfo}>Save</Button>
        </div>
      </Card>

      <Card title="Rate Card (fuel included, round trip)">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-line bg-[#f7f9fc] px-2.5 py-2 text-left">Route</th>
                {settings.vehicles.map((v) => (
                  <th key={v} className="whitespace-nowrap border-b border-line bg-[#f7f9fc] px-2.5 py-2 text-right">{v}</th>
                ))}
                <th className="border-b border-line bg-[#f7f9fc]"></th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(rates).map((r) => (
                <tr key={r}>
                  <td className="border-b border-line px-2.5 py-2 font-semibold">{r}</td>
                  {settings.vehicles.map((v) => (
                    <td key={v} className="border-b border-line px-2 py-1.5">
                      <input
                        type="number" min={0} className="field min-w-24 text-right"
                        value={rates[r][v] ?? ""}
                        onChange={(e) => setRates({ ...rates, [r]: { ...rates[r], [v]: Number(e.target.value) || 0 } })}
                      />
                    </td>
                  ))}
                  <td className="border-b border-line px-2">
                    <Button small variant="danger" onClick={() => deleteRoute(r)}>Del</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="field max-w-72" placeholder="New route name (e.g. North Karachi)" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} />
          <Button variant="secondary" onClick={addRoute}>+ Add Route</Button>
          <Button variant="success" onClick={saveRates}>Save Rates</Button>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Changing rates does not affect old entries — new rates apply to new entries only.
        </p>
      </Card>

      <Card title="Locations & Routes">
        <p className="mb-3 text-[13px] text-muted">
          Set the area (route) for each mill or godown. Once set, typing the location in an entry fills in the route and
          fare automatically. YTM-01 / YTM-07 are your base, so the route is taken from the other party.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="field max-w-72" placeholder="New location name" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
          <Button variant="secondary" onClick={addLocation}>+ Add Location</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-line bg-[#f7f9fc] px-2.5 py-2 text-left">Location</th>
                <th className="border-b border-line bg-[#f7f9fc] px-2.5 py-2 text-left">Route</th>
                <th className="border-b border-line bg-[#f7f9fc]"></th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(settings.locations).sort().map((l) => (
                <tr key={l}>
                  <td className="border-b border-line px-2.5 py-2">
                    {l} {isBase(l) && <span className="ml-1 rounded-md bg-soft px-1.5 py-0.5 text-xs">Base</span>}
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    <select className="field max-w-52" value={settings.locations[l]} onChange={(e) => setLocationRoute(l, e.target.value)}>
                      <option value="">-- Not set --</option>
                      {routeNames.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="border-b border-line px-2">
                    <Button small variant="danger" onClick={() => deleteLocation(l)}>Del</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
