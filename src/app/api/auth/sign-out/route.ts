/** POST /api/auth/sign-out — ends this browser's session. */
import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export const POST = route({ auth: "public" }, async () => {
  await destroySession();
});
