/**
 * Canteen chat: one conversation per staff member with "the canteen team".
 *
 * Unread counting works like v63 (read receipts store the last message id a
 * viewer has seen in a conversation) but the counts come from the server in
 * one query instead of the browser downloading every message.
 * Fixes: the sender of every reply is recorded, and the Operator chat opens
 * the most recent conversation first.
 */
import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export const CHAT_MAX_LENGTH = 500;

/** A staff member's own conversation, oldest first (last 200 messages). */
export async function listConversation(conversationUserId: string) {
  const rows = await db.chatMessage.findMany({
    where: { conversationUserId },
    orderBy: { id: "desc" },
    take: 200,
  });
  return rows.reverse();
}

export function sendMessage(input: { conversationUserId: string; senderId: string; senderRole: Role; message: string }) {
  return db.chatMessage.create({ data: input });
}

/** Mark everything up to the newest message in a conversation as read by `viewerId`. */
export async function markRead(viewerId: string, conversationUserId: string) {
  const last = await db.chatMessage.findFirst({
    where: { conversationUserId },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!last) return;
  await db.chatReadReceipt.upsert({
    where: { viewerId_conversationUserId: { viewerId, conversationUserId } },
    create: { viewerId, conversationUserId, lastReadMessageId: last.id },
    update: { lastReadMessageId: last.id },
  });
}

/** Staff: replies from the canteen they haven't seen yet. */
export async function staffUnreadCount(userId: string) {
  const receipt = await db.chatReadReceipt.findUnique({
    where: { viewerId_conversationUserId: { viewerId: userId, conversationUserId: userId } },
  });
  return db.chatMessage.count({
    where: { conversationUserId: userId, senderRole: { not: "staff" }, id: { gt: receipt?.lastReadMessageId ?? 0 } },
  });
}

/** Operator/admin: staff messages across all conversations they haven't seen yet. */
export async function operatorUnreadCount(viewerId: string) {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM chat_messages m
    LEFT JOIN chat_read_receipts r
      ON r.viewer_id = ${viewerId}::uuid AND r.conversation_user_id = m.conversation_user_id
    WHERE m.sender_role = 'staff' AND m.id > COALESCE(r.last_read_message_id, 0)`;
  return rows[0]?.n ?? 0;
}

/**
 * Operator conversation list, most recent activity first, with a preview of
 * the latest message and how many staff messages are unread in each.
 */
export async function listConversationsForOperator(viewerId: string) {
  return db.$queryRaw<
    { user_id: string; name: string; preview: string; last_at: Date; unread: number }[]
  >`
    WITH latest AS (
      SELECT DISTINCT ON (conversation_user_id) conversation_user_id, message, created_at
      FROM chat_messages
      ORDER BY conversation_user_id, id DESC
    )
    SELECT l.conversation_user_id AS user_id,
           u.full_name AS name,
           l.message AS preview,
           l.created_at AS last_at,
           (SELECT COUNT(*)::int FROM chat_messages m
             WHERE m.conversation_user_id = l.conversation_user_id
               AND m.sender_role = 'staff'
               AND m.id > COALESCE((SELECT r.last_read_message_id FROM chat_read_receipts r
                                     WHERE r.viewer_id = ${viewerId}::uuid
                                       AND r.conversation_user_id = l.conversation_user_id), 0)) AS unread
    FROM latest l
    JOIN users u ON u.id = l.conversation_user_id
    ORDER BY l.created_at DESC`;
}
