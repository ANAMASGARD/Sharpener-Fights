import { SignIn } from "@clerk/nextjs";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { clerkConfigured } from "@/lib/auth-gate";
import { clerkSignInPageRedirects } from "@/lib/auth-redirects";

export default function SignInPage() {
  if (!clerkConfigured()) return <AuthSetupNotice />;
  return (
    <main className="clerk-screen">
      <SignIn routing="path" path="/sign-in" {...clerkSignInPageRedirects} />
    </main>
  );
}
