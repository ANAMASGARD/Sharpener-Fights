import { GameLoader } from "@/components/game-loader";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function HomePage() {
  return (await requireSignedIn()) ? <GameLoader /> : <AuthSetupNotice />;
}
