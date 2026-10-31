/**
 * Expected, user-facing errors.
 *
 * Service functions throw `AppError` with a message that is safe to show to
 * the person (e.g. "Insufficient balance…"). The API wrapper turns it into
 * `{ ok: false, error }` with the given HTTP status. Anything else that is
 * thrown is treated as a bug: logged, and answered with a generic message.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError(`${what} not found`, 404, "not_found");
export const forbidden = (message = "You do not have permission to do this") =>
  new AppError(message, 403, "forbidden");
export const unauthorised = () => new AppError("Please sign in to continue", 401, "unauthorised");
