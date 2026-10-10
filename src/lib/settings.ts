import { z } from "zod";
import { prisma } from "./db";
import { hhmmToMinutes, isValidHHmm } from "./time";

/** Pickup may never be scheduled before the restaurant opens for lunch. */
export const OPENING_FLOOR = "11:00";

const hhmm = z.string().refine(isValidHHmm, "Use 24-hour HH:MM format");

export const businessSchema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  phone: z.string(),
  email: z.string(),
  facebookUrl: z.string(),
  instagramUrl: z.string(),
  /** Free-form hours lines shown on the website, e.g. { label: "Mon–Fri", value: "11 AM – 2 PM" } */
  hours: z.array(z.object({ label: z.string(), value: z.string() })),
  hoursNote: z.string(),
  allergyNotice: z.string(),
  logoImageId: z.string().nullable(),
  heroImageId: z.string().nullable(),
});
export type BusinessSettings = z.infer<typeof businessSchema>;

export const scheduleSchema = z
  .object({
    preorderOpen: hhmm,
    preorderClose: hhmm,
    pickupStart: hhmm,
    pickupEnd: hhmm, // last pickup slot start
    slotMinutes: z.number().int().min(5).max(60),
    /** Luxon weekdays (1 = Mon ... 7 = Sun) on which lunch preorders run. */
    operatingDays: z.array(z.number().int().min(1).max(7)),
    /** Manual override: owner/manager can close preorders immediately. */
    manualClosed: z.boolean(),
    closedMessage: z.string(),
  })
  .superRefine((s, ctx) => {
    if (hhmmToMinutes(s.preorderOpen) >= hhmmToMinutes(s.preorderClose))
      ctx.addIssue({ code: "custom", message: "Preorders must open before they close", path: ["preorderClose"] });
    if (hhmmToMinutes(s.pickupStart) < hhmmToMinutes(OPENING_FLOOR))
      ctx.addIssue({ code: "custom", message: "Pickup cannot start before 11:00 AM", path: ["pickupStart"] });
    if (hhmmToMinutes(s.pickupStart) < hhmmToMinutes(s.preorderClose))
      ctx.addIssue({ code: "custom", message: "Pickup must start after preorders close", path: ["pickupStart"] });
    if (hhmmToMinutes(s.pickupEnd) < hhmmToMinutes(s.pickupStart))
      ctx.addIssue({ code: "custom", message: "Last pickup must be after first pickup", path: ["pickupEnd"] });
  });
export type ScheduleSettings = z.infer<typeof scheduleSchema>;

export const kitchenSchema = z.object({
  /**
   * Workload units the kitchen completes per pickup interval.
   * 1 unit = 1 quesabirria order (3 tacos). Benchmark: 8 orders per 15 minutes.
   */
  capacityUnitsPerSlot: z.number().positive().max(1000),
  /** When the kitchen starts cooking preorders (may be before opening). */
  kitchenStart: hhmm,
  /** Optional cap on how many orders can be handed out in one pickup interval. */
  maxOrdersPerSlot: z.number().int().positive().nullable(),
  /** How long capacity is held while a customer is on the payment page (min 30 for Stripe). */
  holdMinutes: z.number().int().min(30).max(60),
  /** Minutes before pickup an order is flagged as "due soon" on the kitchen screen. */
  dueSoonMinutes: z.number().int().min(1).max(60),
});
export type KitchenSettings = z.infer<typeof kitchenSchema>;

export const taxSchema = z.object({
  /** Basis points: 800 = 8.00% */
  rateBps: z.number().int().min(0).max(2500),
  label: z.string().min(1),
});
export type TaxSettings = z.infer<typeof taxSchema>;

export type AllSettings = {
  business: BusinessSettings;
  schedule: ScheduleSettings;
  kitchen: KitchenSettings;
  tax: TaxSettings;
};

export const DEFAULT_SETTINGS: AllSettings = {
  business: {
    name: "Ay Ay Tacos",
    tagline: "Authentic Mexican food, made from scratch in Northern Maine.",
    addressLine1: "117 Sweden Street",
    city: "Caribou",
    state: "Maine",
    zip: "",
    // Phone and hours stay blank until the owner enters them.
    phone: "",
    email: "ayaytacosmaine@gmail.com",
    facebookUrl: "https://www.facebook.com/AyAyTacos", // from the food trailer banner: "@AyAyTacos"
    instagramUrl: "",
    hours: [],
    hoursNote: "Lunch pickup starts at 11:00 AM.",
    allergyNotice:
      "Our food is prepared in a kitchen that handles wheat, milk, eggs, soy, tree nuts, peanuts and other allergens. We cannot guarantee any dish is allergen-free. If you have a food allergy, please call us before ordering.",
    logoImageId: null,
    heroImageId: null,
  },
  schedule: {
    preorderOpen: "09:00",
    preorderClose: "10:30",
    pickupStart: "11:00",
    pickupEnd: "13:00",
    slotMinutes: 15,
    operatingDays: [], // owner must confirm operating days in the admin dashboard
    manualClosed: false,
    closedMessage: "Online preorders are closed today. Come see us in person!",
  },
  kitchen: {
    capacityUnitsPerSlot: 8,
    kitchenStart: "10:30", // owner: cooking starts at 10:30 so the first orders are ready at 11:00
    maxOrdersPerSlot: null,
    holdMinutes: 31,
    dueSoonMinutes: 10,
  },
  tax: { rateBps: 800, label: "Maine sales tax" },
};

const schemas = { business: businessSchema, schedule: scheduleSchema, kitchen: kitchenSchema, tax: taxSchema };
export type SettingKey = keyof AllSettings;

export async function getSettings(): Promise<AllSettings> {
  const rows = await prisma.setting.findMany();
  const out = structuredClone(DEFAULT_SETTINGS) as AllSettings;
  for (const row of rows) {
    const key = row.key as SettingKey;
    if (!(key in schemas)) continue;
    const merged = { ...(DEFAULT_SETTINGS[key] as object), ...(row.value as object) };
    const parsed = (schemas[key] as z.ZodTypeAny).safeParse(merged);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export async function saveSetting<K extends SettingKey>(key: K, value: unknown): Promise<AllSettings[K]> {
  const current = (await getSettings())[key];
  const merged = { ...(current as object), ...(value as object) };
  const parsed = (schemas[key] as z.ZodTypeAny).parse(merged) as AllSettings[K];
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: parsed as object },
    update: { value: parsed as object },
  });
  return parsed;
}
