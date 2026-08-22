import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { clerkConfigured } from "@/lib/auth-gate";
import { clerkProviderRedirects } from "@/lib/auth-redirects";

export default function OnlineLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured()) return <AuthSetupNotice />;
  return <ClerkProvider {...clerkProviderRedirects}>{children}</ClerkProvider>;
}
