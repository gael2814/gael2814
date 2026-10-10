export type RecipeInput = {
  menuItemId: string;
  lines: { ingredientId: string; ingredientName: string; unit: string; quantity: number; yieldPercent: number | null; rawLabel: string | null }[];
};

export type IngredientLine = {
  ingredientId: string;
  name: string;
  unit: string;
  /** Prepared/cooked amount (as written in recipes). */
  quantity: number;
  /** Raw amount needed when a cooked yield is configured, else null. */
  rawQuantity: number | null;
  yieldPercent: number | null;
  rawLabel: string | null;
  breakdown: { dish: string; dishQuantity: number; quantity: number }[];
};

export type IngredientReport = {
  ingredients: IngredientLine[];
  /** Dishes being prepared that have no recipe configured — nothing is assumed for them. */
  missingRecipes: { name: string; quantity: number }[];
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function buildIngredientReport(
  dishes: { menuItemId: string; name: string; quantity: number }[],
  recipes: RecipeInput[],
): IngredientReport {
  const byItem = new Map(recipes.map((r) => [r.menuItemId, r]));
  const map = new Map<string, IngredientLine>();
  const missingRecipes: IngredientReport["missingRecipes"] = [];

  for (const d of dishes) {
    const r = byItem.get(d.menuItemId);
    if (!r || r.lines.length === 0) {
      missingRecipes.push({ name: d.name, quantity: d.quantity });
      continue;
    }
    for (const l of r.lines) {
      const line =
        map.get(l.ingredientId) ??
        ({
          ingredientId: l.ingredientId,
          name: l.ingredientName,
          unit: l.unit,
          quantity: 0,
          rawQuantity: null,
          yieldPercent: l.yieldPercent,
          rawLabel: l.rawLabel,
          breakdown: [],
        } as IngredientLine);
      const q = l.quantity * d.quantity;
      line.quantity += q;
      line.breakdown.push({ dish: d.name, dishQuantity: d.quantity, quantity: round(q) });
      map.set(l.ingredientId, line);
    }
  }

  const ingredients = [...map.values()]
    .map((l) => ({
      ...l,
      quantity: round(l.quantity),
      rawQuantity: l.yieldPercent && l.yieldPercent > 0 ? round((l.quantity * 100) / l.yieldPercent) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ingredients, missingRecipes };
}

/** Human friendly amount, adding pounds/gallons next to ounces when large. */
export function formatAmount(q: number, unit: string): string {
  const u = unit.trim().toLowerCase();
  const n = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
  if ((u === "oz" || u === "ounce" || u === "ounces") && q >= 16) return `${n} oz (${(q / 16).toFixed(2).replace(/\.?0+$/, "")} lb)`;
  if ((u === "fl oz" || u === "floz") && q >= 128) return `${n} fl oz (${(q / 128).toFixed(2).replace(/\.?0+$/, "")} gal)`;
  if (u === "g" && q >= 1000) return `${n} g (${(q / 1000).toFixed(2).replace(/\.?0+$/, "")} kg)`;
  return `${n} ${unit}`;
}
