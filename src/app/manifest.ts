import type { MetadataRoute } from "next";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

// Lets you "Add to Home screen" on a phone so the app opens like a normal app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#1e4078",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
