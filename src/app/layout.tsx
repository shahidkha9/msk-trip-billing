import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_TAGLINE,
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1e4078",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans text-[15px]">{children}</body>
    </html>
  );
}
