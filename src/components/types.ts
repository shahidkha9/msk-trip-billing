import type { Access } from "@/lib/access";
import type { BackupData } from "@/lib/db";
import type { Customer, Expense, Profile, Receipt, Settings, TableMap, TableName, Trip, Vehicle } from "@/lib/types";

/** Everything the screens need from the main app: the data and the actions that save it. */
export interface AppApi {
  settings: Settings;
  profile: Profile | null;
  access: Access;
  trips: Trip[];
  expenses: Expense[];
  customers: Customer[];
  vehicles: Vehicle[];
  receipts: Receipt[];
  /** save (add or update) one item; shows an error and returns false if it fails */
  save: <K extends TableName>(table: K, item: TableMap[K]) => Promise<boolean>;
  /** delete one item */
  remove: (table: TableName, id: string) => Promise<boolean>;
  updateSettings: (next: Settings) => Promise<boolean>;
  replaceAll: (backup: BackupData) => Promise<boolean>;
  wipeAll: () => Promise<boolean>;
  reload: () => Promise<void>;
  toast: (message: string) => void;
  /** customer name by id ("" if unknown) */
  customerName: (id: string) => string;
}
