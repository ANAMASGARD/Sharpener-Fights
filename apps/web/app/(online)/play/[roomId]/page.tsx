import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { OnlineMatchExperience } from "@/features/multiplayer/online-match-experience";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function OnlinePlayPage({ params }: { params: Promise<{ roomId: string }> }) {
  if (!(await requireSignedIn())) return <AuthSetupNotice />;
  const { roomId } = await params;
  return <OnlineMatchExperience roomId={roomId} />;
}
