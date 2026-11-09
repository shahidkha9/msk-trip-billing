import type { Customer, Expense, Receipt, Settings, Trip, Vehicle } from "./types";

export const DEFAULT_LOAD_CHARGE = 500;
export const DEFAULT_DETENTION_CHARGE = 2500;
/** A 20 ft Mazda costs this much more than a 17 ft Mazda on the same route. */
export const TWENTY_FT_EXTRA = 2000;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Driver Salary", "Repair & Maintenance", "Tyres", "Fuel", "Toll / Challan",
  "Labour", "Mobile & Office", "Token / Fitness / Insurance", "Other",
];

/** Vehicle types offered in the setup wizard. */
export const COMMON_VEHICLE_TYPES = [
  "Suzuki Pickup", "Shehzore", "Mazda 14 ft", "Mazda 17 ft", "Mazda 20 ft",
  "22 ft Truck", "20 ft Container", "40 ft Container / Trailer",
];

/** Starting settings for a NEW account (the setup wizard fills in the rest). */
export const DEFAULT_SETTINGS: Settings = {
  businessName: "",
  phone: "",
  address: "",
  billTo: "",
  defaultCustomerId: "",
  loadCharge: DEFAULT_LOAD_CHARGE,
  detentionCharge: DEFAULT_DETENTION_CHARGE,
  expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
  vehicles: ["Shehzore", "Mazda 14 ft", "Mazda 17 ft", "Mazda 20 ft"],
  routes: {},
  locations: {},
  baseLocations: [],
  setupDone: false,
};

export const cloneSettings = (s: Settings): Settings => JSON.parse(JSON.stringify(s));

/**
 * Brings saved settings up to date with this version.
 * Returns the settings and whether anything changed (so it can be saved once).
 */
export function migrateSettings(raw: Partial<Settings> | null | undefined): { settings: Settings; changed: boolean } {
  if (!raw) return { settings: cloneSettings(DEFAULT_SETTINGS), changed: false };
  const s: Settings = { ...cloneSettings(DEFAULT_SETTINGS), ...JSON.parse(JSON.stringify(raw)) };
  let changed = false;

  // Accounts created before the setup wizard existed are already set up.
  if (typeof raw.setupDone !== "boolean") { s.setupDone = true; changed = true; }
  if (typeof raw.detentionCharge !== "number") { s.detentionCharge = DEFAULT_DETENTION_CHARGE; changed = true; }
  if (!Array.isArray(s.expenseCategories) || s.expenseCategories.length === 0) {
    s.expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
    changed = true;
  }
  if (!Array.isArray(raw.baseLocations)) {
    // Older versions treated every "YTM..." location as the base.
    s.baseLocations = Object.keys(s.locations || {}).filter((l) => /^YTM/i.test(l));
    changed = true;
  }
  if (!Array.isArray(s.vehicles) || s.vehicles.length === 0) { s.vehicles = [...DEFAULT_SETTINGS.vehicles]; changed = true; }
  // Older versions (before 20 ft) — add the 20 ft Mazda at 17 ft + 2,000.
  if (s.vehicles.includes("Mazda 17 ft") && !s.vehicles.includes("Mazda 20 ft") && raw.setupDone === undefined) {
    s.vehicles.splice(s.vehicles.indexOf("Mazda 17 ft") + 1, 0, "Mazda 20 ft");
    for (const r of Object.keys(s.routes)) {
      if (s.routes[r]["Mazda 20 ft"] == null) s.routes[r]["Mazda 20 ft"] = (Number(s.routes[r]["Mazda 17 ft"]) || 0) + TWENTY_FT_EXTRA;
    }
    changed = true;
  }
  for (const k of ["phone", "address", "billTo", "defaultCustomerId", "businessName"] as const) {
    if (typeof s[k] !== "string") { s[k] = ""; changed = true; }
  }
  return { settings: s, changed };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => Number(v) || 0;

/** Makes sure a trip loaded from storage has every field. */
export function normalizeTrip(id: string, d: Partial<Trip>): Trip {
  return {
    id,
    date: str(d.date),
    customerId: str(d.customerId),
    slipNo: str(d.slipNo),
    biltyNo: str(d.biltyNo),
    vehicleNo: str(d.vehicleNo),
    vehicleType: str(d.vehicleType),
    driverName: str(d.driverName),
    from: str(d.from),
    to: str(d.to),
    route: str(d.route),
    qty: str(d.qty),
    rent: n(d.rent),
    loading: !!d.loading,
    loadAmt: n(d.loadAmt),
    detention: !!d.detention,
    detentionAmt: n(d.detentionAmt),
    extra: n(d.extra),
    notes: str(d.notes),
    created: n(d.created),
    hired: !!d.hired,
    hiredParty: str(d.hiredParty),
    hiredCost: n(d.hiredCost),
    hiredPaid: !!d.hiredPaid,
    hiredPaidDate: str(d.hiredPaidDate),
  };
}

export function normalizeExpense(id: string, d: Partial<Expense>): Expense {
  return {
    id, date: str(d.date), category: str(d.category) || "Other", amount: n(d.amount),
    paidTo: str(d.paidTo), vehicleNo: str(d.vehicleNo), notes: str(d.notes), created: n(d.created),
  };
}

export function normalizeCustomer(id: string, d: Partial<Customer>): Customer {
  return { id, name: str(d.name), phone: str(d.phone), address: str(d.address), notes: str(d.notes), created: n(d.created) };
}

export function normalizeVehicle(id: string, d: Partial<Vehicle>): Vehicle {
  return {
    id, vehicleNo: str(d.vehicleNo), type: str(d.type), ownership: d.ownership === "owner" ? "owner" : "company",
    ownerName: str(d.ownerName), ownerPhone: str(d.ownerPhone), ownerSharePercent: n(d.ownerSharePercent),
    driverName: str(d.driverName), driverPhone: str(d.driverPhone), driverSalary: n(d.driverSalary),
    active: d.active !== false, notes: str(d.notes), created: n(d.created),
  };
}

export function normalizeReceipt(id: string, d: Partial<Receipt>): Receipt {
  return {
    id, date: str(d.date), customerId: str(d.customerId), amount: n(d.amount), method: str(d.method) || "Cash",
    reference: str(d.reference), notes: str(d.notes), created: n(d.created),
  };
}

export const normalizers = {
  trips: normalizeTrip,
  expenses: normalizeExpense,
  customers: normalizeCustomer,
  vehicles: normalizeVehicle,
  receipts: normalizeReceipt,
} as const;
