/**
 * Human-readable references, in the same formats as v63 so staff and the
 * canteen recognise them:
 *   PCH-20261030110259-2D8156        staff food ticket
 *   TOPUP-20261030110929-0F29C4      wallet top-up request
 *   WEEKLY-20261030110231-8A1B2C     weekly ticket credit
 *   GUEST-20261030110259-2D8156      guest payment reference
 *   GUEST-PCH-20261030110259-2D8156  guest food ticket
 * The timestamp is Lagos time; the 6-character suffix is random, so two
 * references made in the same second still differ.
 */
import { randomBytes } from "node:crypto";

function lagosStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

function suffix(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

export const makeReference = (prefix: "PCH" | "TOPUP" | "WEEKLY" | "GUEST" | "GUEST-PCH") =>
  `${prefix}-${lagosStamp()}-${suffix()}`;
