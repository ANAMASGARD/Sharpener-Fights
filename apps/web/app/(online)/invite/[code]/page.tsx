import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { InviteExperience } from "@/features/multiplayer/invite-experience";
import { clerkConfigured } from "@/lib/auth-gate";

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  if (!clerkConfigured()) return <AuthSetupNotice />;
  const { code } = await params;
  return <InviteExperience code={code} />;
}
