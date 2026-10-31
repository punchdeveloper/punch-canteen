/**
 * POST /api/admin/staff/import (multipart, field "csv") — bulk add employees
 * from a full_name,email CSV. Everyone is added with the Staff role.
 */
import { route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { importStaff, parseStaffCsv } from "@/server/staff";

const MAX_CSV_BYTES = 1024 * 1024;

export const POST = route({ auth: "admin" }, async ({ user, req }) => {
  const file = (await req.formData()).get("csv");
  if (!(file instanceof File) || !file.size) throw new AppError("Choose a CSV file first.");
  if (file.size > MAX_CSV_BYTES) throw new AppError("CSV file must be 1 MB or smaller.");
  const rows = parseStaffCsv(await file.text());
  return await importStaff(rows, user.id);
});
