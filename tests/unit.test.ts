/**
 * Unit tests for the pure rules: money maths, Weekly Ticket amounts,
 * references, CSV parsing, photo detection, safe redirects, month logic and
 * the URL -> area mapping.
 */
import { describe, expect, it } from "vitest";
import { formatMoney, isValidWeeklyTicketAmount, nairaToKobo, splitPayment } from "@/lib/money";
import { makeReference } from "@/lib/references";
import { parseCsvLine, parseStaffCsv } from "@/server/staff";
import { detectImageType } from "@/server/menu";
import { safeNextPath } from "@/server/auth";
import { previousLagosMonth } from "@/server/wallet";
import { normaliseCart } from "@/server/orders";
import { areaOf, bodyClassFor, workspaceLabel } from "@/lib/areas";

describe("splitPayment — Weekly Ticket first, then Personal Wallet (v63 place_order rule)", () => {
  it("uses only the Weekly Ticket when it covers the order", () => {
    expect(splitPayment(200000, 250000, 0)).toEqual({ fromWeeklyTicket: 200000, fromWallet: 0 });
  });
  it("splits across both balances", () => {
    expect(splitPayment(330000, 200000, 500000)).toEqual({ fromWeeklyTicket: 200000, fromWallet: 130000 });
  });
  it("uses only the wallet when there is no Weekly Ticket", () => {
    expect(splitPayment(80000, 0, 100000)).toEqual({ fromWeeklyTicket: 0, fromWallet: 80000 });
  });
  it("refuses when both together can't cover it", () => {
    expect(splitPayment(330000, 200000, 129999)).toBeNull();
  });
  it("accepts an exact match", () => {
    expect(splitPayment(330000, 200000, 130000)).toEqual({ fromWeeklyTicket: 200000, fromWallet: 130000 });
  });
});

describe("money formatting and Weekly Ticket amounts", () => {
  it("formats kobo like v63", () => {
    expect(formatMoney(250000)).toBe("₦2,500");
    expect(formatMoney(5000)).toBe("₦50");
    expect(formatMoney(125050)).toBe("₦1,250.5");
    expect(formatMoney(-200000)).toBe("-₦2,000");
  });
  it("converts naira to kobo without float drift", () => {
    expect(nairaToKobo(19.99)).toBe(1999);
    expect(nairaToKobo(2500)).toBe(250000);
  });
  it("allows ₦2,000–₦5,000 in ₦500 steps only", () => {
    expect([2000, 2500, 5000].every((n) => isValidWeeklyTicketAmount(nairaToKobo(n)))).toBe(true);
    expect([1500, 2300, 5500, 0].some((n) => isValidWeeklyTicketAmount(nairaToKobo(n)))).toBe(false);
  });
});

describe("references", () => {
  it("use the v63 formats with a Lagos timestamp and random suffix", () => {
    expect(makeReference("PCH")).toMatch(/^PCH-\d{14}-[0-9A-F]{6}$/);
    expect(makeReference("GUEST-PCH")).toMatch(/^GUEST-PCH-\d{14}-[0-9A-F]{6}$/);
    expect(makeReference("TOPUP")).not.toBe(makeReference("TOPUP"));
  });
});

describe("cart", () => {
  it("merges duplicate lines and drops empty ones", () => {
    expect(normaliseCart([{ menuItemId: 1, quantity: 1 }, { menuItemId: 1, quantity: 2 }, { menuItemId: 2, quantity: 0 }])).toEqual([
      { menuItemId: 1, quantity: 3 },
    ]);
  });
});

describe("staff CSV import", () => {
  it("handles quotes and escaped quotes", () => {
    expect(parseCsvLine('"Ade, Test","say ""hi""",x')).toEqual(["Ade, Test", 'say "hi"', "x"]);
  });
  it("needs full_name and email columns, lower-cases emails, skips bad rows", () => {
    const rows = parseStaffCsv('﻿full_name,email\nA One,A.One@PunchNG.com\nNo Email,\nBad,not-an-email\n');
    expect(rows).toEqual([{ fullName: "A One", email: "a.one@punchng.com" }]);
    expect(() => parseStaffCsv("name,mail\nA,b@c.d")).toThrow(/full_name and email/);
  });
});

describe("photo uploads are checked by content, not file name", () => {
  it("recognises JPG, PNG and WebP", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpg");
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))).toBe("webp");
  });
  it("rejects anything else, whatever it is called", () => {
    expect(detectImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});

describe("sign-in redirects stay on this site", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/operator")).toBe("/operator");
  });
  it("blocks other sites and loops", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "/login", "/auth/verify", null, ""]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});

describe("month-end expiry month", () => {
  it("is the previous month in Lagos time", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Lagos -> October expires.
    expect(previousLagosMonth(new Date("2026-10-31T23:30:00Z")).toISOString().slice(0, 10)).toBe("2026-10-01");
    // 22:30 UTC on 31 Oct is still October in Lagos -> September.
    expect(previousLagosMonth(new Date("2026-10-31T22:30:00Z")).toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(previousLagosMonth(new Date("2027-01-01T08:00:00Z")).toISOString().slice(0, 10)).toBe("2026-12-01");
  });
});

describe("URL areas", () => {
  it("maps URLs to the v63 body classes and labels", () => {
    expect(bodyClassFor("/")).toBe("staff");
    expect(bodyClassFor("/login")).toBe("staff login-view");
    expect(bodyClassFor("/operator")).toBe("");
    expect(areaOf("/operator/sign-in")).toBe("portal");
    expect(workspaceLabel(areaOf("/operator/chat"))).toBe("OPERATOR WORKSPACE");
  });
});
