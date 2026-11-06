import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSK Trip Billing",
  description: "MSK Transport Service — trip entries, automatic fares and PDF bills",
  appleWebApp: { capable: true, title: "MSK Trips", statusBarStyle: "default" },
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
