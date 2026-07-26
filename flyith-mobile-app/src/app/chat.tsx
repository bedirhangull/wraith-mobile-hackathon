import type { JSX } from "react";

import { useRequireSession } from "@/features/auth/useRequireSession";
import { TravelChatScreen } from "@/features/travel-chat/TravelChatScreen";

export default function ChatScreen(): JSX.Element {
  useRequireSession();
  return <TravelChatScreen />;
}
