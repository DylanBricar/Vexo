"use client";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { LoginScreen } from "@/components/chat/LoginScreen";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const controller = useChat();
  return controller.state.userId ? (
    <ChatScreen {...controller} />
  ) : (
    <LoginScreen actions={controller.actions} state={controller.state} />
  );
}
