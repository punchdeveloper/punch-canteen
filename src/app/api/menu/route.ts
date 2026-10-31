/** GET /api/menu — public menu (available items only) and Today's Special. */
import { route } from "@/lib/api";
import { loadMenu } from "@/server/loaders";

export const GET = route({ auth: "public" }, async () => ({ menu: await loadMenu() }));
