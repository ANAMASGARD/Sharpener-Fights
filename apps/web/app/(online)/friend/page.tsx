import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { FriendRoomLauncher } from "@/features/multiplayer/friend-room-launcher";
import { requireSignedIn } from "@/lib/auth-gate";

export default async function FriendPage() {
  return (await requireSignedIn()) ? <FriendRoomLauncher /> : <AuthSetupNotice />;
}
