/** One trip (one row in the bill). */
export interface Trip {
  id: string;
  date: string; // YYYY-MM-DD
  slipNo: string;
  biltyNo: string;
  vehicleNo: string; // e.g. ABCD-1234
  vehicleType: string; // e.g. "Mazda 17 ft"
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
}

/** Fares per route, per vehicle type. */
export type RateCard = Record<string, Record<string, number>>;

export interface Settings {
  businessName: string;
  phone: string;
  billTo: string;
  loadCharge: number;
  detentionCharge: number;
  vehicles: string[];
  routes: RateCard;
  /** location name -> route name ("" = not set) */
  locations: Record<string, string>;
}

/** Fields the user fills in on the entry form. */
export type TripInput = Omit<Trip, "id" | "created" | "loadAmt" | "detentionAmt">;
