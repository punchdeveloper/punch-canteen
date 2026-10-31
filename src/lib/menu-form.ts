/**
 * Parse the "Add new menu item" / "Save changes" form (multipart, because it
 * can carry a photo). Shared by the create and update routes.
 */
import "server-only";
import { z } from "zod";
import { nairaAmount, optionalText } from "@/lib/validation";
import type { MenuInput } from "@/server/menu";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the item name").max(100),
  price: nairaAmount.refine((k) => k <= 100_000_000, "Price is too high"),
  category: z.enum(["Meals", "Drinks"]),
  description: optionalText(240),
  allergens: optionalText(200),
});

export async function readMenuForm(form: FormData): Promise<{ input: MenuInput; photo: File | null }> {
  const parsed = schema.parse({
    name: form.get("name"),
    price: form.get("price"),
    category: form.get("category"),
    description: form.get("description"),
    allergens: form.get("allergens"),
  });
  const photo = form.get("photo");
  return {
    input: {
      name: parsed.name,
      priceKobo: parsed.price,
      category: parsed.category,
      description: parsed.description,
      allergens: parsed.allergens,
    },
    photo: photo instanceof File && photo.size > 0 ? photo : null,
  };
}
