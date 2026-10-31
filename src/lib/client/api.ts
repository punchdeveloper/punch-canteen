/**
 * Browser-side helpers for calling our API.
 * Every API answers { ok: true, ...data } or { ok: false, error }.
 * `apiSend` throws an Error with the server's friendly message on failure,
 * so components can show it as-is.
 */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  let data: { ok?: boolean; error?: string; code?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("The server didn't respond properly. Please try again.", res.status);
  }
  if (!res.ok || !data.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status, data.code);
  return data as T;
}

/** SWR fetcher: GET a URL and return the parsed `{ ok: true, ... }` body. */
export const fetcher = <T,>(url: string) => fetch(url, { cache: "no-store" }).then((r) => handle<T>(r));

/** POST/PUT/PATCH/DELETE with a JSON body (or FormData for uploads). */
export async function apiSend<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
    body: isForm ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}
