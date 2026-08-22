import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRuntime } from "@/features/pwa/pwa-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sharpener Fights",
  description: "Aim like pool. Hit like physics. Own the desk.",
  applicationName: "Sharpener Fights",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "SharpFights",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#183345",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><PwaRuntime>{children}</PwaRuntime></body>
    </html>
  );
}
