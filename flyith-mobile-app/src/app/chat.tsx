import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { useEffect } from "react";
import { View } from "react-native";

import { useRequireSession } from "@/features/auth/useRequireSession";
import { TravelChatScreen } from "@/features/travel-chat/TravelChatScreen";
import { createConversationId } from "@/features/travel-chat/services/persistence";

export default function ChatScreen(): JSX.Element {
  useRequireSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const conversationId = typeof id === "string" && id.length > 0 ? id : undefined;

  useEffect(() => {
    if (!conversationId) {
      router.replace(`/chat?id=${createConversationId()}`);
    }
  }, [conversationId, router]);

  if (!conversationId) {
    return <View className="flex-1 bg-white" />;
  }

  return <TravelChatScreen key={conversationId} conversationId={conversationId} />;
}
