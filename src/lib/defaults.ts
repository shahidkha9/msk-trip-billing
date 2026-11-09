import type { Expense, Settings, Trip } from "./types";

export const DEFAULT_LOAD_CHARGE = 500;
export const DEFAULT_DETENTION_CHARGE = 2500;
/** A 20 ft Mazda costs this much more than a 17 ft Mazda on the same route. */
export const TWENTY_FT_EXTRA = 2000;

export const DEFAULT_SETTINGS: Settings = {
  businessName: "MSK Transport Service",
  phone: "",
  billTo: "Yunus Textile Mills Limited",
  loadCharge: DEFAULT_LOAD_CHARGE,
  detentionCharge: DEFAULT_DETENTION_CHARGE,
  expenseCategories: [
    "Driver Salary", "Repair & Maintenance", "Tyres", "Fuel", "Toll / Challan",
    "Labour", "Mobile & Office", "Token / Fitness / Insurance", "Other",
  ],
  vehicles: ["Mazda 14 ft", "Mazda 17 ft", "Mazda 20 ft", "Shehzore"],
  routes: {
    Landhi: { "Mazda 14 ft": 5000, "Mazda 17 ft": 6000, "Mazda 20 ft": 8000, Shehzore: 3500 },
    Korangi: { "Mazda 14 ft": 7000, "Mazda 17 ft": 7500, "Mazda 20 ft": 9500, Shehzore: 6000 },
    SITE: { "Mazda 14 ft": 12000, "Mazda 17 ft": 15000, "Mazda 20 ft": 17000, Shehzore: 10000 },
  },
  locations: {
    "YTM-01": "", "YTM-07": "", "GULAHMED TEXTILE": "", "TEXTILE FORT": "", "SANAM TEXTILE": "",
    "ORIENT TEXTILE": "", "K&B DOUBLING": "", "ZAMAN TEXTILE": "", "JAMAL WAREHOUSE": "",
    "R.S GODOWN": "", "HIBA LANDHI": "Landhi", "HABIB PRIME GODOWN": "", "AMAN TEX": "",
    "A.S.R ENTERPRISES (S.I.T.E)": "SITE", "HAMEEDA & RASHEED": "", "SAYA WEAVING": "",
    "JAN TEX": "", "HALEEMA APPAREL": "", "VALITEX": "",
  },
};

export const cloneSettings = (s: Settings): Settings => JSON.parse(JSON.stringify(s));

/**
 * Brings settings saved by an older version up to date:
 * adds missing fields, the detention charge and the Mazda 20 ft rates.
 * Returns the settings and whether anything changed.
 */
export function migrateSettings(raw: Partial<Settings> | null | undefined): { settings: Settings; changed: boolean } {
  if (!raw) return { settings: cloneSettings(DEFAULT_SETTINGS), changed: true };
  const s: Settings = { ...cloneSettings(DEFAULT_SETTINGS), ...JSON.parse(JSON.stringify(raw)) };
  let changed = false;
  if (typeof raw.detentionCharge !== "number") { s.detentionCharge = DEFAULT_DETENTION_CHARGE; changed = true; }
  if (!Array.isArray(raw.vehicles) || raw.vehicles.length === 0) { s.vehicles = [...DEFAULT_SETTINGS.vehicles]; changed = true; }
  if (!Array.isArray(s.expenseCategories) || s.expenseCategories.length === 0) {
    s.expenseCategories = [...DEFAULT_SETTINGS.expenseCategories];
  }
  if (!s.vehicles.includes("Mazda 20 ft")) {
    const i = s.vehicles.indexOf("Mazda 17 ft");
    s.vehicles.splice(i >= 0 ? i + 1 : s.vehicles.length, 0, "Mazda 20 ft");
    changed = true;
  }
  for (const r of Object.keys(s.routes)) {
    if (s.routes[r]["Mazda 20 ft"] == null) {
      s.routes[r]["Mazda 20 ft"] = (Number(s.routes[r]["Mazda 17 ft"]) || 0) + TWENTY_FT_EXTRA;
      changed = true;
    }
  }
  return { settings: s, changed };
}

/** Makes sure a trip loaded from storage has every field (older entries had no detention). */
export function normalizeTrip(id: string, d: Partial<Trip>): Trip {
  return {
    id,
    date: d.date ?? "",
    slipNo: d.slipNo ?? "",
    biltyNo: d.biltyNo ?? "",
    vehicleNo: d.vehicleNo ?? "",
    vehicleType: d.vehicleType ?? "",
    from: d.from ?? "",
    to: d.to ?? "",
    route: d.route ?? "",
    qty: d.qty ?? "",
    rent: Number(d.rent) || 0,
    loading: !!d.loading,
    loadAmt: Number(d.loadAmt) || 0,
    detention: !!d.detention,
    detentionAmt: Number(d.detentionAmt) || 0,
    extra: Number(d.extra) || 0,
    notes: d.notes ?? "",
    created: Number(d.created) || 0,
    hired: !!d.hired,
    hiredParty: d.hiredParty ?? "",
    hiredCost: Number(d.hiredCost) || 0,
    hiredPaid: !!d.hiredPaid,
    hiredPaidDate: d.hiredPaidDate ?? "",
  };
}

/** Makes sure an expense loaded from storage has every field. */
export function normalizeExpense(id: string, d: Partial<Expense>): Expense {
  return {
    id,
    date: d.date ?? "",
    category: d.category ?? "Other",
    amount: Number(d.amount) || 0,
    paidTo: d.paidTo ?? "",
    vehicleNo: d.vehicleNo ?? "",
    notes: d.notes ?? "",
    created: Number(d.created) || 0,
  };
}
