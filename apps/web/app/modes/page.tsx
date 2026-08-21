import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { ModeSelector } from "@/features/multiplayer/mode-selector";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function ModesPage() {
  return (await requireSignedIn()) ? <ModeSelector /> : <AuthSetupNotice />;
}
