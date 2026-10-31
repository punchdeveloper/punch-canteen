/**
 * Page title block — v63's head(title, subtitle, action):
 *   <div class="title"><div><h1/><p class="muted"/></div>{action}</div>
 */
import type { ReactNode } from "react";

export function PageHead({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="title">
      <div>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {action}
    </div>
  );
}

/** Lagos-time date formats used across the app (same output as v63). */
export const fmt = {
  dateTime: (iso: string) => new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
  dateTimeShort: (iso: string) =>
    new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }),
  date: (iso: string) => new Date(iso).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" }),
  chat: (iso: string) =>
    new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso)) + " WAT",
};
