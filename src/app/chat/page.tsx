/** Canteen Chat with the canteen team. Signed-in staff only. */
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { markRead } from "@/server/chat";
import { loadMyChat } from "@/server/loaders";
import { ChatView } from "@/components/views/chat-view";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  const user = (await requireStaff("/chat"))!;
  const messages = await loadMyChat(user.id);
  await markRead(user.id, user.id);
  return <ChatView initial={messages} />;
}
