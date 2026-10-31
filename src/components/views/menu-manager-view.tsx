"use client";
/**
 * Manage today's menu (v63 "manage" view): Today's Special, add an item,
 * edit every item (name, price, category, description, allergens, photo) and
 * mark items available/unavailable. Photo previews show before saving.
 */
import Link from "next/link";
import useSWR from "swr";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { PageHead } from "@/components/page-head";
import { apiSend, fetcher } from "@/lib/client/api";
import { formatMoney, koboToNaira } from "@/lib/money";
import type { MenuManagerData } from "@/server/loaders";

type Item = MenuManagerData["items"][number];

/** File input + live preview of the chosen photo. */
function PhotoField({ current, name, hint }: { current?: string | null; name: string; hint: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  }
  return (
    <label className="field">
      Food photo
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- small preview of our own media file
        <img className="menu-photo-preview" src={current} alt={name} />
      ) : null}
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
      <small className="muted">{hint}</small>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img className="menu-photo-preview" hidden={!preview} src={preview ?? undefined} alt="Selected food photo preview" />
    </label>
  );
}

export function MenuManagerView({ initial }: { initial: MenuManagerData }) {
  const { refreshMenu, toast } = useApp();
  const { data, mutate } = useSWR<{ manager: MenuManagerData }>("/api/operator/menu", fetcher, { fallbackData: { manager: initial } });
  const m = data?.manager ?? initial;
  const [busy, setBusy] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const specialChoices = m.items.filter((i) => i.available && i.category === "Meals");

  async function run(key: string, fn: () => Promise<unknown>, success: string, after?: () => void) {
    setBusy(key);
    try {
      await fn();
      await Promise.all([mutate(), refreshMenu()]);
      after?.();
      toast(success);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function saveSpecial(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = Number(new FormData(e.currentTarget).get("menu_item_id"));
    if (!id) return toast("Please choose a meal");
    run("special", () => apiSend("/api/operator/todays-special", "PUT", { menuItemId: id }), "Today's Special updated on the Home page");
  }

  function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(
      "add",
      () => apiSend("/api/operator/menu", "POST", form),
      form.get("photo") instanceof File && (form.get("photo") as File).size ? "New menu item and photo added" : "New menu item added",
      () => setAddKey((k) => k + 1), // reset the form
    );
  }

  function saveItem(e: FormEvent<HTMLFormElement>, item: Item) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const hasPhoto = form.get("photo") instanceof File && (form.get("photo") as File).size > 0;
    run(`save-${item.id}`, () => apiSend(`/api/operator/menu/${item.id}`, "POST", form), hasPhoto ? "Menu item and photo updated" : "Menu item updated");
  }

  function toggle(item: Item) {
    run(
      `stock-${item.id}`,
      () => apiSend(`/api/operator/menu/${item.id}`, "PATCH", { available: !item.available }),
      item.available ? "Item marked unavailable" : "Item is available again",
    );
  }

  return (
    <>
      <PageHead
        title="Manage today’s menu"
        sub="Changes here are saved straight away and appear on the staff menu."
        action={
          <Link className="btn secondary" href="/operator">
            ← Live orders
          </Link>
        }
      />

      <form className="panel" onSubmit={saveSpecial}>
        <h2>Today’s Special</h2>
        <p className="muted">Choose the meal to feature on the Home page. Its current photo, name, description and price will be used automatically.</p>
        <div className="menu-edit">
          <label className="field">
            Featured meal
            <select name="menu_item_id" required defaultValue={m.todaysSpecialId ?? ""} key={m.todaysSpecialId ?? "none"}>
              {!m.todaysSpecialId ? <option value="">Choose a meal</option> : null}
              {specialChoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {formatMoney(i.priceKobo)}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy === "special"}>
              Save Today’s Special
            </button>
          </div>
        </div>
      </form>

      <form className="panel" onSubmit={addItem} key={addKey}>
        <h2>Add new menu item</h2>
        <div className="menu-edit">
          <label className="field">
            Item name
            <input name="name" required maxLength={100} />
          </label>
          <label className="field">
            Price (₦)
            <input name="price" type="number" min={0} step={1} required />
          </label>
          <label className="field">
            Category
            <select name="category" defaultValue="Meals">
              <option>Meals</option>
              <option>Drinks</option>
            </select>
          </label>
          <label className="field">
            Description
            <input name="description" maxLength={240} placeholder="Optional description" />
          </label>
          <label className="field">
            Allergens
            <input name="allergens" maxLength={200} placeholder="Not specified" />
          </label>
          <PhotoField name="New item" hint="JPG, PNG or WebP · maximum 5 MB" />
          <div className="actions">
            <button className="btn" type="submit" disabled={busy === "add"}>
              {busy === "add" ? "Adding…" : "Add item"}
            </button>
          </div>
        </div>
      </form>

      <div className="panel">
        <h2>Current menu</h2>
        {m.items.length ? (
          m.items.map((item) => (
            <form key={`${item.id}-${item.imageUrl}`} className="menu-edit live-menu-edit" onSubmit={(e) => saveItem(e, item)}>
              <label className="field">
                Item name
                <input name="name" defaultValue={item.name} required maxLength={100} />
              </label>
              <label className="field">
                Price (₦)
                <input name="price" type="number" min={0} max={1000000} step={1} required defaultValue={koboToNaira(item.priceKobo)} />
              </label>
              <label className="field">
                Category
                <select name="category" defaultValue={item.category}>
                  <option>Meals</option>
                  <option>Drinks</option>
                </select>
              </label>
              <label className="field">
                Description
                <input name="description" maxLength={240} defaultValue={item.description ?? ""} />
              </label>
              <label className="field">
                Allergens
                <input name="allergens" maxLength={200} defaultValue={item.allergens ?? ""} />
              </label>
              <PhotoField current={item.imageUrl} name={item.name} hint="Choose a new photo only if you want to replace the current one." />
              <div className="actions">
                <button className="btn" type="submit" disabled={busy === `save-${item.id}`}>
                  {busy === `save-${item.id}` ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="btn secondary" disabled={busy === `stock-${item.id}`} onClick={() => toggle(item)}>
                  {item.available ? "Mark unavailable" : "Make available"}
                </button>
                {!item.available ? <span className="tag warn">Hidden from the staff menu</span> : null}
              </div>
            </form>
          ))
        ) : (
          <p className="muted">No menu items yet. Add the first one above.</p>
        )}
      </div>
    </>
  );
}
