"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { api, money } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

type Ingredient = { id: string; name: string; unit: string; yieldPercent: number | null; rawLabel: string | null; notes: string | null };
type Item = {
  id: string; name: string; description: string; priceCents: number; categoryId: string; imageId: string | null; featured: boolean;
  priceUnderReview: boolean; active: boolean; preorderable: boolean; soldOut: boolean; dailyLimit: number | null; prepUnits: number;
  tacosPerItem: number; productionNote: string | null; sortOrder: number;
  recipe: { ingredientId: string; quantity: number; ingredient: Ingredient }[];
};
type Category = { id: string; name: string; subtitle: string | null; items: Item[] };

export function MenuAdmin({ canEdit, canRecipes }: { canEdit: boolean; canRecipes: boolean }) {
  const [data, setData] = useState<{ categories: Category[]; ingredients: Ingredient[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "ingredients">("items");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => setData(await api(`/api/staff/menu`)), []);
  useEffect(() => {
    load().catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [load]);

  async function patch(id: string, body: Partial<Item>, ok = "Saved.") {
    try {
      await api(`/api/staff/menu/${id}`, { method: "PATCH", body });
      setMsg({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <div>
      <PageTitle
        actions={
          canRecipes && (
            <div className="flex rounded-full bg-cream-dark p-1 text-sm font-bold">
              <button onClick={() => setTab("items")} className={`rounded-full px-3 py-1 ${tab === "items" ? "bg-forest text-cream" : ""}`}>Menu items</button>
              <button onClick={() => setTab("ingredients")} className={`rounded-full px-3 py-1 ${tab === "ingredients" ? "bg-forest text-cream" : ""}`}>Ingredients</button>
            </div>
          )
        }
      >
        Menu
      </PageTitle>
      {msg && <div className="mb-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {!data ? (
        <p className="animate-pulse">Loading…</p>
      ) : tab === "ingredients" ? (
        <Ingredients ingredients={data.ingredients} reload={load} setMsg={setMsg} />
      ) : (
        <div className="space-y-6">
          {!canEdit && <Notice>As a manager you can mark items sold out, set daily limits, turn preordering on/off and adjust prep settings. Prices and descriptions are changed by the owner.</Notice>}
          {data.categories.map((c) => (
            <section key={c.id}>
              <h2 className="font-display text-xl uppercase text-terracotta">{c.name}</h2>
              <div className="mt-2 space-y-2">
                {c.items.map((item) => (
                  <Card key={item.id} className={`bg-white p-3 ${!item.active ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest/10">
                        {item.imageId && <img src={`/api/images/${item.imageId}`} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-[160px] flex-1">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-sm text-ink/70">
                          {money(item.priceCents)}
                          {item.priceUnderReview && <span className="ml-2 rounded bg-mustard px-1.5 text-xs font-bold">price under review</span>}
                          {!item.active && <span className="ml-2 rounded bg-ink/20 px-1.5 text-xs font-bold">hidden</span>}
                          {item.dailyLimit != null && <span className="ml-2 text-xs">limit {item.dailyLimit}/day</span>}
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 text-sm font-semibold">
                        <input type="checkbox" className="h-5 w-5" checked={item.soldOut} onChange={(e) => patch(item.id, { soldOut: e.target.checked }, e.target.checked ? `${item.name} marked sold out.` : `${item.name} is available again.`)} />
                        Sold out
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-semibold">
                        <input type="checkbox" className="h-5 w-5" checked={item.preorderable} onChange={(e) => patch(item.id, { preorderable: e.target.checked })} />
                        Preorder
                      </label>
                      <Btn variant="ghost" onClick={() => setOpen(open === item.id ? null : item.id)}>{open === item.id ? "Close" : "Edit"}</Btn>
                    </div>
                    {open === item.id && (
                      <ItemEditor item={item} categories={data.categories} ingredients={data.ingredients} canEdit={canEdit} canRecipes={canRecipes} patch={patch} reload={load} setMsg={setMsg} />
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
          {canEdit && <AddItem categories={data.categories} reload={load} setMsg={setMsg} />}
        </div>
      )}
    </div>
  );
}

function ItemEditor({
  item, categories, ingredients, canEdit, canRecipes, patch, reload, setMsg,
}: {
  item: Item; categories: Category[]; ingredients: Ingredient[]; canEdit: boolean; canRecipes: boolean;
  patch: (id: string, b: Partial<Item>, ok?: string) => Promise<void>; reload: () => Promise<void>;
  setMsg: (m: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [f, setF] = useState({
    name: item.name, description: item.description, price: (item.priceCents / 100).toFixed(2), categoryId: item.categoryId,
    featured: item.featured, priceUnderReview: item.priceUnderReview, active: item.active,
    dailyLimit: item.dailyLimit?.toString() ?? "", prepUnits: String(item.prepUnits), tacosPerItem: String(item.tacosPerItem),
    sortOrder: String(item.sortOrder),
  });
  const [recipe, setRecipe] = useState(item.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity) })));
  const [uploading, setUploading] = useState(false);

  async function save() {
    const price = Math.round(Number(f.price) * 100);
    const prep = Number(f.prepUnits);
    if (canEdit && (!Number.isFinite(price) || price < 0)) return setMsg({ kind: "error", text: "Enter a valid price." });
    if (!Number.isFinite(prep) || prep < 0) return setMsg({ kind: "error", text: "Enter a valid prep workload." });
    const body: Partial<Item> = {
      dailyLimit: f.dailyLimit.trim() === "" ? null : Math.max(0, Math.floor(Number(f.dailyLimit))),
      prepUnits: prep,
      tacosPerItem: Math.max(0, Math.floor(Number(f.tacosPerItem) || 0)),
    };
    if (canEdit)
      Object.assign(body, {
        name: f.name, description: f.description, priceCents: price, categoryId: f.categoryId, featured: f.featured,
        priceUnderReview: f.priceUnderReview, active: f.active, sortOrder: Math.floor(Number(f.sortOrder) || 0),
      });
    await patch(item.id, body, `${f.name} saved.`);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/staff/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await patch(item.id, { imageId: d.id }, "Photo updated.");
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function saveRecipe() {
    try {
      const lines = recipe.filter((r) => r.ingredientId && Number(r.quantity) > 0).map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) }));
      await api(`/api/staff/menu/${item.id}/recipe`, { method: "PUT", body: { lines } });
      setMsg({ kind: "ok", text: "Recipe saved." });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function remove() {
    if (!confirm(`Remove ${item.name} from the menu?`)) return;
    try {
      const r = await api<{ archived?: boolean }>(`/api/staff/menu/${item.id}`, { method: "DELETE" });
      setMsg({ kind: "ok", text: r.archived ? `${item.name} was hidden (kept for order history).` : `${item.name} deleted.` });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  }

  const lbl = "block text-xs font-bold uppercase tracking-wide text-forest";
  return (
    <div className="mt-3 grid gap-4 border-t-2 border-forest/10 pt-3 lg:grid-cols-2">
      <div className="space-y-2">
        {canEdit && (
          <>
            <label className={lbl}>Name<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className={lbl}>Description<textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className={lbl}>Price ($)<input inputMode="decimal" className={inputCls} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
              <label className={lbl}>Category
                <select className={inputCls} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Show on website</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} /> Featured on homepage</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.priceUnderReview} onChange={(e) => setF({ ...f, priceUnderReview: e.target.checked })} /> Price under review (staff note)</label>
            </div>
            <div>
              <span className={lbl}>Photo</span>
              <div className="mt-1 flex items-center gap-3">
                {item.imageId && <img src={`/api/images/${item.imageId}`} alt="" className="h-20 w-20 rounded-lg object-cover" />}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-sm" />
                {item.imageId && <Btn variant="ghost" onClick={() => patch(item.id, { imageId: null }, "Photo removed.")}>Remove</Btn>}
              </div>
              <p className="mt-1 text-xs text-ink/60">JPG, PNG or WebP, up to 4 MB.</p>
            </div>
          </>
        )}
        <div className="grid grid-cols-3 gap-2">
          <label className={lbl}>Daily limit<input inputMode="numeric" placeholder="No limit" className={inputCls} value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /></label>
          <label className={lbl} title="Kitchen workload per item. 1 = one quesabirria order.">Prep workload<input inputMode="decimal" className={inputCls} value={f.prepUnits} onChange={(e) => setF({ ...f, prepUnits: e.target.value })} /></label>
          <label className={lbl}>Tacos per item<input inputMode="numeric" className={inputCls} value={f.tacosPerItem} onChange={(e) => setF({ ...f, tacosPerItem: e.target.value })} /></label>
        </div>
        <p className="text-xs text-ink/60">
          Prep workload is how much kitchen time one item takes compared to one quesabirria order (1.0). Example: 0.5 = half the time. Used to calculate realistic pickup times.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={save}>Save changes</Btn>
          {canEdit && <Btn variant="danger" onClick={remove}>Remove item</Btn>}
        </div>
      </div>

      {canRecipes && (
        <div>
          <span className={lbl}>Recipe (amount per 1 {item.name})</span>
          <div className="mt-1 space-y-1">
            {recipe.map((r, i) => {
              const ing = ingredients.find((x) => x.id === r.ingredientId);
              return (
                <div key={i} className="flex items-center gap-2">
                  <select className={inputCls} value={r.ingredientId} onChange={(e) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, ingredientId: e.target.value } : x)))}>
                    <option value="">Choose ingredient…</option>
                    {ingredients.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <input inputMode="decimal" className={`${inputCls} w-24`} value={r.quantity} onChange={(e) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                  <span className="w-12 text-xs">{ing?.unit}</span>
                  <button className="text-terracotta" aria-label="Remove line" onClick={() => setRecipe(recipe.filter((_, j) => j !== i))}>✕</button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <Btn variant="ghost" onClick={() => setRecipe([...recipe, { ingredientId: "", quantity: "" }])}>+ Add ingredient</Btn>
            <Btn variant="secondary" onClick={saveRecipe}>Save recipe</Btn>
          </div>
          <p className="mt-2 text-xs text-ink/60">Only saved recipes are used in the ingredient report. Nothing is guessed.</p>
        </div>
      )}
    </div>
  );
}

function AddItem({ categories, reload, setMsg }: { categories: Category[]; reload: () => Promise<void>; setMsg: (m: { kind: "ok" | "error"; text: string }) => void }) {
  const [f, setF] = useState({ name: "", price: "", categoryId: categories[0]?.id ?? "", description: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/staff/menu`, { body: { name: f.name, priceCents: Math.round(Number(f.price) * 100), categoryId: f.categoryId, description: f.description } });
      setMsg({ kind: "ok", text: `${f.name} added.` });
      setF({ ...f, name: "", price: "", description: "" });
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Failed" });
    }
  }
  return (
    <Card>
      <h2 className="font-display text-lg text-forest">Add a menu item</h2>
      <form onSubmit={add} className="mt-2 grid gap-2 sm:grid-cols-4">
        <input required placeholder="Name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input required inputMode="decimal" placeholder="Price ($)" className={inputCls} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <select className={inputCls} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Btn type="submit">Add item</Btn>
        <input placeholder="Description (optional)" className={`${inputCls} sm:col-span-4`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </form>
    </Card>
  );
}

function Ingredients({ ingredients, reload, setMsg }: { ingredients: Ingredient[]; reload: () => Promise<void>; setMsg: (m: { kind: "ok" | "error"; text: string }) => void }) {
  const [f, setF] = useState({ name: "", unit: "oz" });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  };
  return (
    <div className="space-y-3">
      <Notice>
        Set a <strong>cooked yield %</strong> to see raw amounts. Example: if 10 lb of raw beef becomes 6 lb of cooked birria, the yield is 60%. Recipes use the cooked amount.
      </Notice>
      <Card className="overflow-x-auto bg-white p-0">
        <table className="w-full text-sm">
          <thead className="bg-forest text-left text-cream"><tr><th className="p-2">Ingredient</th><th>Unit</th><th>Cooked yield %</th><th>Raw name</th><th></th></tr></thead>
          <tbody>
            {ingredients.map((i) => (
              <IngredientRow key={i.id} ing={i} run={run} />
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/api/staff/ingredients`, { body: f }), `${f.name} added.`).then(() => setF({ name: "", unit: "oz" }));
          }}
        >
          <input required placeholder="New ingredient" className={`${inputCls} max-w-xs`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input required placeholder="Unit (oz, lb, each)" className={`${inputCls} w-36`} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <Btn type="submit">Add ingredient</Btn>
        </form>
      </Card>
    </div>
  );
}

function IngredientRow({ ing, run }: { ing: Ingredient; run: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [f, setF] = useState({ name: ing.name, unit: ing.unit, yieldPercent: ing.yieldPercent?.toString() ?? "", rawLabel: ing.rawLabel ?? "" });
  return (
    <tr className="border-b border-forest/10">
      <td className="p-1"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></td>
      <td className="p-1"><input className={`${inputCls} w-20`} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></td>
      <td className="p-1"><input inputMode="decimal" placeholder="—" className={`${inputCls} w-20`} value={f.yieldPercent} onChange={(e) => setF({ ...f, yieldPercent: e.target.value })} /></td>
      <td className="p-1"><input placeholder="e.g. raw beef" className={inputCls} value={f.rawLabel} onChange={(e) => setF({ ...f, rawLabel: e.target.value })} /></td>
      <td className="whitespace-nowrap p-1">
        <Btn
          variant="ghost"
          onClick={() =>
            run(
              () => api(`/api/staff/ingredients/${ing.id}`, {
                method: "PATCH",
                body: { name: f.name, unit: f.unit, yieldPercent: f.yieldPercent.trim() ? Number(f.yieldPercent) : null, rawLabel: f.rawLabel.trim() || null },
              }),
              "Ingredient saved.",
            )
          }
        >
          Save
        </Btn>
        <button className="ml-2 text-terracotta" onClick={() => confirm(`Delete ${ing.name}? It will be removed from all recipes.`) && run(() => api(`/api/staff/ingredients/${ing.id}`, { method: "DELETE" }), "Deleted.")}>✕</button>
      </td>
    </tr>
  );
}
