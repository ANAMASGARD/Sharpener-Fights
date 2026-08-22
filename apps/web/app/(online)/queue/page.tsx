import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { QueueExperience } from "@/features/multiplayer/queue-experience";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function QueuePage() {
  return (await requireSignedIn()) ? <QueueExperience /> : <AuthSetupNotice />;
}
