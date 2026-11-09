/** One trip (one row in the bill). */
export interface Trip {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string; // who you bill for this trip
  slipNo: string;
  biltyNo: string;
  vehicleNo: string; // e.g. ABCD-1234
  vehicleType: string; // e.g. "Mazda 17 ft"
  driverName: string;
  from: string;
  to: string;
  route: string; // rate area, e.g. "Landhi"
  qty: string;
  rent: number; // fare
  loading: boolean;
  loadAmt: number; // amount charged for loading/unloading on this trip
  detention: boolean;
  detentionAmt: number; // amount charged for detention on this trip
  extra: number;
  notes: string;
  created: number;
  /** true = the vehicle belongs to someone you must pay (family vehicle or outside/hired vehicle) */
  hired: boolean;
  /** the vehicle owner you pay */
  hiredParty: string;
  /** amount you have to pay the vehicle owner for this trip */
  hiredCost: number;
  /** have you paid the owner yet? */
  hiredPaid: boolean;
  /** date you paid them (YYYY-MM-DD) */
  hiredPaidDate: string;
}

/** One expense (driver salary, repair, etc.). */
export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  paidTo: string; // e.g. driver name, workshop
  vehicleNo: string; // optional
  notes: string;
  created: number;
}

/** A company you transport for and send bills to. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  created: number;
}

/** "company" = your own vehicle; "owner" = belongs to someone you pay per trip (family / attached vehicle). */
export type Ownership = "company" | "owner";

/** A vehicle in your fleet, with its owner and driver. */
export interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  ownership: Ownership;
  ownerName: string;
  ownerPhone: string;
  /** owner's share of each trip total in % (0 = type the amount yourself on each trip) */
  ownerSharePercent: number;
  driverName: string;
  driverPhone: string;
  driverSalary: number; // monthly
  active: boolean;
  notes: string;
  created: number;
}

/** Money received from a customer. */
export interface Receipt {
  id: string;
  date: string;
  customerId: string;
  amount: number;
  method: string; // Cash, Cheque, Bank transfer...
  reference: string; // cheque no. etc.
  notes: string;
  created: number;
}

/** Fares per route, per vehicle type. */
export type RateCard = Record<string, Record<string, number>>;

export interface Settings {
  businessName: string;
  phone: string;
  address: string;
  /** old single "Bill To" — only used to move older data to the Customers list */
  billTo: string;
  /** customer used for trips saved before customers existed */
  defaultCustomerId: string;
  loadCharge: number;
  detentionCharge: number;
  expenseCategories: string[];
  vehicles: string[]; // vehicle TYPES
  routes: RateCard;
  /** location name -> route name ("" = not set) */
  locations: Record<string, string>;
  /** your own godowns / mills; the fare route is taken from the OTHER side of the trip */
  baseLocations: string[];
  /** false until a new account finishes the setup wizard */
  setupDone: boolean;
}

/** Subscription / account info (from the profiles table). */
export interface Profile {
  userId: string;
  email: string;
  businessName: string;
  phone: string;
  status: "active" | "suspended";
  isAdmin: boolean;
  trialEndsAt: string | null;
  paidUntil: string | null;
  adminNote: string;
  createdAt: string;
}

/** Profile row as the admin sees it (with usage). */
export interface AdminUser extends Profile {
  tripCount: number;
  lastActivity: string | null;
}

export type TableName = "trips" | "expenses" | "customers" | "vehicles" | "receipts";
export interface TableMap {
  trips: Trip;
  expenses: Expense;
  customers: Customer;
  vehicles: Vehicle;
  receipts: Receipt;
}
