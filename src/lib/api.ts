/**
 * Route-handler wrapper (convention #7/#8).
 *
 * Every API route is written as:
 *
 *   export const POST = route({ auth: "operator", body: schema }, async ({ user, body }) => {
 *     ...
 *     return { order };            // becomes { ok: true, order }
 *   });
 *
 * The wrapper:
 *  1. Checks the session and the role ("signed-in", "operator" = operator or
 *     admin, "admin"), re-reading the user from the database every time.
 *  2. Parses the JSON body / query string with Zod before any logic runs.
 *  3. Shapes success as `{ ok: true, ...data }` and failures as
 *     `{ ok: false, error }` with the right status code.
 *  4. Rejects cross-site POSTs (Origin must match the host) as a CSRF guard.
 */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { AppError, forbidden, unauthorised } from "@/lib/errors";
import { getSessionUser, isOperatorOrAdmin, type SessionUser } from "@/lib/auth/session";

type AuthLevel = "public" | "signed-in" | "operator" | "admin";

type Ctx<B, Q, A extends AuthLevel> = {
  req: NextRequest;
  user: A extends "public" ? SessionUser | null : SessionUser;
  body: B;
  query: Q;
  params: Record<string, string>;
};

type Options<B extends ZodType | undefined, Q extends ZodType | undefined, A extends AuthLevel> = {
  auth: A;
  body?: B;
  query?: Q;
};

type Infer<T> = T extends ZodType ? z.infer<T> : undefined;

export function route<
  A extends AuthLevel,
  B extends ZodType | undefined = undefined,
  Q extends ZodType | undefined = undefined,
>(
  opts: Options<B, Q, A>,
  handler: (ctx: Ctx<Infer<B>, Infer<Q>, A>) => Promise<Record<string, unknown> | void>,
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) {
        throw new AppError("Cross-site request blocked", 403, "csrf");
      }

      const user = await getSessionUser();
      if (opts.auth !== "public") {
        if (!user) throw unauthorised();
        if (opts.auth === "operator" && !isOperatorOrAdmin(user.role)) throw forbidden();
        if (opts.auth === "admin" && user.role !== "admin") throw forbidden();
      }

      const body = opts.body ? opts.body.parse(await readJson(req)) : undefined;
      const query = opts.query
        ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
        : undefined;
      const params = (await context?.params) ?? {};

      const data = await handler({
        req,
        user: user as Ctx<Infer<B>, Infer<Q>, A>["user"],
        body: body as Infer<B>,
        query: query as Infer<Q>,
        params,
      });
      return NextResponse.json({ ok: true, ...(data ?? {}) });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Turn any thrown value into a `{ ok: false, error }` response. */
export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      { ok: false, error: first?.message ?? "Invalid request", code: "invalid", issues: err.issues },
      { status: 400 },
    );
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again.", code: "server_error" },
    { status: 500 },
  );
}

async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Request body must be JSON", 400, "invalid_json");
  }
}

/**
 * CSRF guard: browsers always send `Origin` on cross-site POST/PUT/PATCH/DELETE.
 * We accept requests whose Origin host matches the request Host (or the
 * configured APP_URL). Requests without Origin (curl, server-to-server) pass,
 * because cookies are SameSite=Lax and wouldn't be attached cross-site anyway.
 */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && o.host === host) return true;
    if (process.env.APP_URL && o.host === new URL(process.env.APP_URL).host) return true;
  } catch {
    return false;
  }
  return false;
}
