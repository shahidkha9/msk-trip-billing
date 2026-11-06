import type { MetadataRoute } from "next";

// Lets you "Add to Home screen" on a phone so the app opens like a normal app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MSK Trip Billing",
    short_name: "MSK Trips",
    description: "MSK Transport Service — trip entries and bills",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#1e4078",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
