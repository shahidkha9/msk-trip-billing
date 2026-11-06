import type { Settings, Trip } from "@/lib/types";

/** Everything the screens need from the main app: the data and the actions that save it. */
export interface AppApi {
  settings: Settings;
  trips: Trip[];
  saveTrip: (trip: Trip) => Promise<boolean>;
  removeTrip: (id: string) => Promise<boolean>;
  updateSettings: (next: Settings) => Promise<boolean>;
  replaceAll: (settings: Settings, trips: Partial<Trip>[]) => Promise<boolean>;
  wipeTrips: () => Promise<boolean>;
  reload: () => Promise<void>;
  toast: (message: string) => void;
}
