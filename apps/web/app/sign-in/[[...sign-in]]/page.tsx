import { SignIn } from "@clerk/nextjs";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { clerkConfigured } from "@/lib/auth-gate";

export default function SignInPage() {
  if (!clerkConfigured()) return <AuthSetupNotice />;
  return <main className="clerk-screen"><SignIn routing="path" path="/sign-in" /></main>;
}
