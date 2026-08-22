import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { clerkConfigured } from "@/lib/auth-gate";
import { clerkProviderRedirects } from "@/lib/auth-redirects";
import { multiplayerConfigured } from "@/server/runtime";

export default function OnlineLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured() || !multiplayerConfigured()) return <AuthSetupNotice />;
  return <ClerkProvider {...clerkProviderRedirects}>{children}</ClerkProvider>;
}
