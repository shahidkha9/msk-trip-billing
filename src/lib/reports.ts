import type { Customer, Expense, Receipt, Trip, Vehicle } from "./types";
import { hiredCostOf, sumBy, tripTotal } from "./utils";

/* ---------- 1. Trip profit (before expenses) ---------- */
export interface TripProfit {
  trips: number;
  ownTrips: number;
  ownerTrips: number;
  income: number; // what customers pay for the trips
  ownerPay: number; // what you pay vehicle owners
  profit: number; // income - ownerPay
}
export function tripProfit(trips: Trip[]): TripProfit {
  const income = sumBy(trips, tripTotal);
  const ownerPay = sumBy(trips, hiredCostOf);
  const ownerTrips = trips.filter((t) => t.hired).length;
  return { trips: trips.length, ownTrips: trips.length - ownerTrips, ownerTrips, income, ownerPay, profit: income - ownerPay };
}

/* ---------- 2. Expenses ---------- */
export interface ExpenseSummary {
  count: number;
  total: number;
  byCategory: [string, number][];
}
export function expenseSummary(expenses: Expense[]): ExpenseSummary {
  const m: Record<string, number> = {};
  for (const x of expenses) m[x.category] = (m[x.category] || 0) + x.amount;
  return { count: expenses.length, total: sumBy(expenses, (x) => x.amount), byCategory: Object.entries(m).sort((a, b) => b[1] - a[1]) };
}

/* ---------- 3. Per vehicle ---------- */
export interface VehicleRow {
  vehicleNo: string;
  type: string;
  owner: string; // "" = your own
  driver: string;
  trips: number;
  income: number;
  ownerPay: number;
  expenses: number;
  profit: number; // income - ownerPay - expenses
  inFleet: boolean;
}
export function perVehicle(trips: Trip[], expenses: Expense[], fleet: Vehicle[]): VehicleRow[] {
  const rows = new Map<string, VehicleRow>();
  const get = (no: string) => {
    if (!rows.has(no)) {
      const v = fleet.find((x) => x.vehicleNo === no);
      rows.set(no, {
        vehicleNo: no, type: v?.type ?? "", owner: v?.ownership === "owner" ? v.ownerName : "", driver: v?.driverName ?? "",
        trips: 0, income: 0, ownerPay: 0, expenses: 0, profit: 0, inFleet: !!v,
      });
    }
    return rows.get(no)!;
  };
  for (const v of fleet) if (v.active) get(v.vehicleNo);
  for (const t of trips) {
    if (!t.vehicleNo) continue;
    const r = get(t.vehicleNo);
    r.trips++;
    r.income += tripTotal(t);
    r.ownerPay += hiredCostOf(t);
    if (!r.type) r.type = t.vehicleType;
    if (!r.inFleet && t.hired && !r.owner) r.owner = t.hiredParty;
  }
  for (const x of expenses) if (x.vehicleNo) get(x.vehicleNo).expenses += x.amount;
  for (const r of rows.values()) r.profit = r.income - r.ownerPay - r.expenses;
  return [...rows.values()].sort((a, b) => b.income - a.income || a.vehicleNo.localeCompare(b.vehicleNo));
}

/* ---------- 4. Per driver ---------- */
export interface DriverRow {
  driver: string;
  vehicles: string[];
  trips: number;
  income: number; // trip income from trips they drove
  salary: number; // "Driver Salary" expenses paid to them
  otherPaid: number; // other expenses paid to them (advances, khurak...)
}
export function perDriver(trips: Trip[], expenses: Expense[], fleet: Vehicle[]): DriverRow[] {
  const rows = new Map<string, DriverRow>();
  const key = (s: string) => s.trim().toLowerCase();
  const get = (name: string) => {
    const k = key(name);
    if (!rows.has(k)) rows.set(k, { driver: name.trim(), vehicles: [], trips: 0, income: 0, salary: 0, otherPaid: 0 });
    return rows.get(k)!;
  };
  for (const v of fleet) if (v.active && v.driverName.trim()) {
    const r = get(v.driverName);
    if (!r.vehicles.includes(v.vehicleNo)) r.vehicles.push(v.vehicleNo);
  }
  for (const t of trips) {
    if (!t.driverName.trim()) continue;
    const r = get(t.driverName);
    r.trips++;
    r.income += tripTotal(t);
    if (t.vehicleNo && !r.vehicles.includes(t.vehicleNo)) r.vehicles.push(t.vehicleNo);
  }
  for (const x of expenses) {
    if (!x.paidTo.trim() || !rows.has(key(x.paidTo))) continue;
    const r = get(x.paidTo);
    if (x.category === "Driver Salary") r.salary += x.amount;
    else r.otherPaid += x.amount;
  }
  return [...rows.values()].sort((a, b) => b.trips - a.trips || a.driver.localeCompare(b.driver));
}

/* ---------- 5. Customer balances (what customers owe you) ---------- */
export interface CustomerBalance {
  customer: Customer;
  trips: number;
  billed: number;
  received: number;
  balance: number; // billed - received
  lastTrip: string;
}
export function customerBalances(customers: Customer[], trips: Trip[], receipts: Receipt[]): CustomerBalance[] {
  return customers
    .map((c) => {
      const ct = trips.filter((t) => t.customerId === c.id);
      const billed = sumBy(ct, tripTotal);
      const received = sumBy(receipts.filter((r) => r.customerId === c.id), (r) => r.amount);
      const lastTrip = ct.reduce((m, t) => (t.date > m ? t.date : m), "");
      return { customer: c, trips: ct.length, billed, received, balance: billed - received, lastTrip };
    })
    .sort((a, b) => b.balance - a.balance || a.customer.name.localeCompare(b.customer.name));
}

/* ---------- 6. Owner payments (what you owe vehicle owners) ---------- */
export interface OwnerDue {
  owner: string;
  trips: number;
  amount: number;
}
export function ownerDues(trips: Trip[]): OwnerDue[] {
  const m = new Map<string, OwnerDue>();
  for (const t of trips) {
    if (!t.hired || t.hiredPaid) continue;
    const k = t.hiredParty || "(no name)";
    const r = m.get(k) ?? { owner: k, trips: 0, amount: 0 };
    r.trips++;
    r.amount += hiredCostOf(t);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}
