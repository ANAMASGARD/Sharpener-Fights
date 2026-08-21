import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { LocalMatchExperience } from "@/features/multiplayer/local-match-experience";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function LocalPlayPage() {
  return (await requireSignedIn()) ? <LocalMatchExperience /> : <AuthSetupNotice />;
}
