// localStorage persistence. Everything stays in this browser on this device;
// nothing is synchronised. All reads are defensive: corrupted or missing data
// never crashes the app.
import { sanitizeDesign } from "./design";
import { defaultPricingSettings } from "../engine/quote";
import type { Design, PricingSettings, SavedDesign } from "./types";

const KEYS = {
  designs: "wardrobe-studio:designs:v1",
  current: "wardrobe-studio:current:v1",
  pricing: "wardrobe-studio:pricing:v1",
  prefs: "wardrobe-studio:prefs:v1",
};

export interface Prefs {
  angle: number;
  showDims: boolean;
  whatsappNumber: string;
}

const DEFAULT_PREFS: Prefs = { angle: 0, showDims: true, whatsappNumber: "" };

export function storageAvailable(): boolean {
  try {
    const k = "__ws_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readJSON(key: string): { ok: true; value: unknown } | { ok: false; corrupt: boolean } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { ok: false, corrupt: false };
  }
  if (raw === null) return { ok: false, corrupt: false };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Keep a copy of unreadable data so nothing is silently destroyed.
    try {
      localStorage.setItem(`${key}:corrupt-backup`, raw);
    } catch {
      /* ignore */
    }
    return { ok: false, corrupt: true };
  }
}

/** Returns false if the write failed (quota exceeded / storage blocked). */
function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedDesigns(): { designs: SavedDesign[]; warnings: string[] } {
  const res = readJSON(KEYS.designs);
  const warnings: string[] = [];
  if (!res.ok) {
    if (res.corrupt) warnings.push("Saved designs could not be read and were reset. A backup copy was kept in this browser.");
    return { designs: [], warnings };
  }
  if (!Array.isArray(res.value)) {
    warnings.push("Saved design data had an unexpected format and was ignored.");
    return { designs: [], warnings };
  }
  let skipped = 0;
  const designs: SavedDesign[] = [];
  for (const item of res.value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      skipped++;
      continue;
    }
    const { design } = sanitizeDesign(item.design);
    designs.push({ id: item.id, savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(), design });
  }
  if (skipped) warnings.push(`${skipped} damaged saved design${skipped > 1 ? "s were" : " was"} skipped.`);
  return { designs, warnings };
}

export const persistSavedDesigns = (designs: SavedDesign[]) => writeJSON(KEYS.designs, designs);

export function loadCurrentDesign(): Design | null {
  const res = readJSON(KEYS.current);
  return res.ok ? sanitizeDesign(res.value).design : null;
}

export const persistCurrentDesign = (d: Design) => writeJSON(KEYS.current, d);

export function loadPricing(): PricingSettings {
  const base = defaultPricingSettings();
  const res = readJSON(KEYS.pricing);
  if (!res.ok || !res.value || typeof res.value !== "object") return base;
  const v = res.value as Partial<Record<keyof PricingSettings, Record<string, unknown>>>;
  const numbers = (src: Record<string, unknown> | undefined, into: Record<string, number>) => {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(into)) {
      const n = Number(src[k]);
      if (src[k] !== undefined && src[k] !== "" && Number.isFinite(n) && n >= 0) into[k] = n;
    }
  };
  const g = v.general;
  if (g && typeof g === "object") {
    const general = base.general as unknown as Record<string, unknown>;
    for (const k of Object.keys(general)) {
      if (typeof general[k] === "number") {
        const n = Number(g[k]);
        if (g[k] !== undefined && Number.isFinite(n) && n >= 0) general[k] = n;
      } else if (typeof g[k] === "string") general[k] = String(g[k]).slice(0, 40);
    }
  }
  numbers(v.laminates, base.laminates);
  numbers(v.shutters, base.shutters);
  numbers(v.handles, base.handles);
  numbers(v.accessories, base.accessories);
  return base;
}

export const persistPricing = (p: PricingSettings) => writeJSON(KEYS.pricing, p);

export function loadPrefs(): Prefs {
  const res = readJSON(KEYS.prefs);
  if (!res.ok || !res.value || typeof res.value !== "object") return { ...DEFAULT_PREFS };
  const v = res.value as Partial<Prefs>;
  return {
    angle: Number.isFinite(Number(v.angle)) ? Math.max(-35, Math.min(35, Number(v.angle))) : 0,
    showDims: typeof v.showDims === "boolean" ? v.showDims : true,
    whatsappNumber: typeof v.whatsappNumber === "string" ? v.whatsappNumber.replace(/\D/g, "").slice(0, 15) : "",
  };
}

export const persistPrefs = (p: Prefs) => writeJSON(KEYS.prefs, p);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
