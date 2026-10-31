/**
 * Shared Zod schemas for API input (convention #7).
 * Money arrives from forms in NAIRA and is converted to kobo here, so the
 * rest of the server only ever sees integers.
 */
import { z } from "zod";
import { nairaToKobo } from "@/lib/money";

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .pipe(z.email({ message: "Enter a valid email address" }));

export const personName = z.string().trim().min(2, "Enter a full name").max(120);

/** Naira amount typed by a person -> integer kobo. */
export const nairaAmount = z.coerce
  .number({ message: "Enter an amount" })
  .finite()
  .min(0, "Amount can't be negative")
  .max(10_000_000)
  .transform(nairaToKobo);

export const rating = z.coerce.number().int().min(1).max(5);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const cartLines = z
  .array(
    z.object({
      menuItemId: z.coerce.number().int().positive("Choose a menu item"),
      quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(20, "You can order at most 20 of one item"),
    }),
  )
  .min(1, "Your cart is empty")
  .max(30);

/** Nigerian-style phone number: digits, spaces, +, -, (), 7–15 digits in total. */
export const phoneNumber = z
  .string()
  .trim()
  .max(30)
  .refine((v) => /^[+\d][\d\s()-]*$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15, {
    message: "Enter a valid phone number",
  });

export const idParam = z.coerce.number().int().positive();
export const uuidParam = z.uuid();
