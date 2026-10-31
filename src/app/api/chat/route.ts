/**
 * GET  /api/chat — my conversation with the canteen (also marks it read).
 * POST /api/chat { message } — send a message to the canteen team.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { CHAT_MAX_LENGTH, markRead, sendMessage } from "@/server/chat";
import { loadMyChat } from "@/server/loaders";

export const GET = route({ auth: "signed-in" }, async ({ user }) => {
  const messages = await loadMyChat(user.id);
  await markRead(user.id, user.id);
  return { messages };
});

const schema = z.object({ message: z.string().trim().min(1, "Type a message").max(CHAT_MAX_LENGTH) });

export const POST = route({ auth: "signed-in", body: schema }, async ({ user, body }) => {
  await sendMessage({ conversationUserId: user.id, senderId: user.id, senderRole: "staff", message: body.message });
  await markRead(user.id, user.id);
});
