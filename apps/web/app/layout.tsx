import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkConfigured } from "@/lib/auth-gate";
import { clerkProviderRedirects } from "@/lib/auth-redirects";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sharpener Fights",
  description: "Aim like pool. Hit like physics. Own the desk.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#9ba38c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const content = clerkConfigured() ? (
    <ClerkProvider {...clerkProviderRedirects}>{children}</ClerkProvider>
  ) : children;
  return (
    <html lang="en">
      <body>{content}</body>
    </html>
  );
}
