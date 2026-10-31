/**
 * POST /api/auth/request-link  { email, next? }
 * Emails a one-time sign-in link if the email is in the staff directory.
 * Always answers { ok: true } for approved and unknown emails alike.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { route } from "@/lib/api";
import { email } from "@/lib/validation";
import { clientIp } from "@/lib/auth/session";
import { requestMagicLink } from "@/server/auth";

const schema = z.object({ email, next: z.string().max(200).optional().nullable() });

export const POST = route({ auth: "public", body: schema }, async ({ body }) => {
  await requestMagicLink(body.email, body.next ?? null, clientIp(await headers()));
});
