/**
 * GET  /api/operator/chat?user=<staffId> — conversation list (newest first)
 *      and the open conversation, which is marked read for this operator.
 * POST /api/operator/chat { userId, message } — reply to a staff member.
 *      The reply records which operator/admin sent it.
 */
import { z } from "zod";
import { route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { CHAT_MAX_LENGTH, markRead, sendMessage } from "@/server/chat";
import { loadOperatorChat } from "@/server/loaders";

export const GET = route({ auth: "operator", query: z.object({ user: z.uuid().optional() }) }, async ({ user, query }) => {
  const chat = await loadOperatorChat(user.id, query.user ?? null);
  if (chat.activeUserId) await markRead(user.id, chat.activeUserId);
  return { chat };
});

const schema = z.object({ userId: z.uuid(), message: z.string().trim().min(1, "Type a reply").max(CHAT_MAX_LENGTH) });

export const POST = route({ auth: "operator", body: schema }, async ({ user, body }) => {
  const staff = await db.user.findUnique({ where: { id: body.userId }, select: { id: true } });
  if (!staff) throw new AppError("That staff member no longer exists.", 404);
  await sendMessage({
    conversationUserId: body.userId,
    senderId: user.id,
    senderRole: user.role === "admin" ? "admin" : "operator",
    message: body.message,
  });
  await markRead(user.id, body.userId);
});
