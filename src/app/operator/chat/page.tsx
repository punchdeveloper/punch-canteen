/** Operator chat with staff. ?user=<id> opens a specific conversation. */
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/guards";
import { markRead } from "@/server/chat";
import { loadOperatorChat } from "@/server/loaders";
import { OperatorChatView } from "@/components/views/operator-chat-view";

export const metadata: Metadata = { title: "Canteen Chat" };

export default async function OperatorChatPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const user = await requirePortal("operator");
  const { user: active } = await searchParams;
  const chat = await loadOperatorChat(user.id, active && /^[0-9a-f-]{36}$/i.test(active) ? active : null);
  if (chat.activeUserId) await markRead(user.id, chat.activeUserId);
  return <OperatorChatView initial={chat} />;
}
