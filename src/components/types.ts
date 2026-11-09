import type { Expense, Settings, Trip } from "@/lib/types";

/** Everything the screens need from the main app: the data and the actions that save it. */
export interface AppApi {
  settings: Settings;
  trips: Trip[];
  expenses: Expense[];
  /** false until expenses-setup.sql has been run in Supabase */
  expensesReady: boolean;
  saveTrip: (trip: Trip) => Promise<boolean>;
  removeTrip: (id: string) => Promise<boolean>;
  saveExpense: (expense: Expense) => Promise<boolean>;
  removeExpense: (id: string) => Promise<boolean>;
  updateSettings: (next: Settings) => Promise<boolean>;
  replaceAll: (settings: Settings, trips: Partial<Trip>[], expenses: Partial<Expense>[] | null) => Promise<boolean>;
  wipeAll: () => Promise<boolean>;
  reload: () => Promise<void>;
  toast: (message: string) => void;
}
