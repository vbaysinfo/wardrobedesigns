// Indicative quotation. All rates are user-editable sample prices; areas are
// computed from the visual layout and are NOT cutting-list quantities.
import {
  accessories as accessoryList,
  defaultPricing,
  getAccessory,
  getHandleFinish,
  getHandleStyle,
  getLaminate,
  getModel,
  getShutterStyle,
  laminates,
  shutterStyles,
  handleStyles,
} from "../data/catalog";
import { resolveDoor } from "../state/design";
import type { Design, PricingSettings } from "../state/types";
import { computeLayout, sqft } from "./layout";

const LAMINATE_SHARE: Record<string, number> = {
  glass: 0,
  "reeded-glass": 0,
  mirror: 0.15,
  "mirror-arch": 0.25,
  cane: 0.45,
};

export interface QuoteLine {
  label: string;
  detail: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  laminateAreas: { code: string; name: string; sqft: number; amount: number }[];
}

export function defaultPricingSettings(): PricingSettings {
  return {
    general: { ...defaultPricing },
    laminates: Object.fromEntries(laminates.map((l) => [l.code, l.pricePerSqft])),
    shutters: Object.fromEntries(shutterStyles.map((s) => [s.id, s.ratePerSqft])),
    handles: Object.fromEntries(handleStyles.map((h) => [h.id, h.price])),
    accessories: Object.fromEntries(accessoryList.map((a) => [a.id, a.price])),
  };
}

const price = (map: Record<string, number>, id: string, fallback: number) =>
  Number.isFinite(map[id]) ? map[id] : fallback;

export function computeQuote(design: Design, pricing: PricingSettings): Quote {
  const g = pricing.general;
  const model = getModel(design.modelId);
  const L = computeLayout(design);
  const lines: QuoteLine[] = [];
  const f1 = (n: number) => n.toFixed(1);

  const bodyArea = sqft({ w: L.width, h: L.bodyHeight });
  lines.push({
    label: "Wardrobe construction",
    detail: `${f1(bodyArea)} sq.ft × ${g.currency}${g.constructionPerSqft}${model.baseFactor !== 1 ? ` × ${model.baseFactor} (${model.name})` : ""}`,
    amount: bodyArea * g.constructionPerSqft * model.baseFactor,
  });

  if (L.loft) {
    const loftArea = sqft({ w: L.width, h: L.loftHeight });
    lines.push({
      label: "Loft unit",
      detail: `${f1(loftArea)} sq.ft × ${g.currency}${g.loftPerSqft}`,
      amount: loftArea * g.loftPerSqft,
    });
  }

  if (L.drawers.length) {
    lines.push({
      label: "External drawers",
      detail: `${L.drawers.length} × ${g.currency}${g.drawerEach}`,
      amount: L.drawers.length * g.drawerEach,
    });
  }

  // Laminate surface areas by material code.
  const areas = new Map<string, number>();
  const add = (code: string, a: number) => areas.set(code, (areas.get(code) ?? 0) + a);
  let shutterStyleCost = 0;
  const styleCounts = new Map<string, number>();
  L.doors.forEach((d) => {
    const r = resolveDoor(design, d.index);
    const a = sqft(d.rect);
    if (r.style === "two-tone") {
      add(r.laminate, a * 0.6);
      add(r.secondary, a * 0.4);
    } else {
      // Share of the shutter face that is laminate (glass, mirror and cane infill are priced in the style rate).
      add(r.laminate, a * (LAMINATE_SHARE[r.style] ?? 1));
    }
    shutterStyleCost += a * price(pricing.shutters, r.style, getShutterStyle(r.style).ratePerSqft);
    styleCounts.set(r.style, (styleCounts.get(r.style) ?? 0) + 1);
  });
  L.loft?.doors.forEach((d) => add(design.materials.loft, sqft(d.rect)));
  L.drawers.forEach((r) => add(design.materials.drawer, sqft(r)));
  // Two exposed side panels (full height × depth).
  add(design.materials.carcass, sqft({ w: L.depth, h: L.height }) * 2);

  const wastage = 1 + g.laminateWastagePct / 100;
  const laminateAreas = [...areas].map(([code, a]) => {
    const lam = getLaminate(code);
    const rate = price(pricing.laminates, code, lam.pricePerSqft);
    return { code, name: lam.name, sqft: a, amount: a * wastage * rate };
  });
  lines.push({
    label: "Laminates",
    detail: `${f1(laminateAreas.reduce((s, x) => s + x.sqft, 0))} sq.ft visible surface + ${g.laminateWastagePct}% wastage`,
    amount: laminateAreas.reduce((s, x) => s + x.amount, 0),
  });

  lines.push({
    label: "Shutter finish",
    detail: [...styleCounts].map(([s, c]) => `${c} × ${getShutterStyle(s).name}`).join(", "),
    amount: shutterStyleCost,
  });

  const handleCount = L.doors.length + (L.loft?.doors.length ?? 0) + L.drawers.length;
  const hs = getHandleStyle(design.handle.style);
  const hf = getHandleFinish(design.handle.finish);
  const unitHandle = price(pricing.handles, hs.id, hs.price) * (hs.id === "none" ? 1 : hf.priceFactor);
  lines.push({
    label: "Handles",
    detail: `${handleCount} × ${hs.name}${hs.id === "none" ? "" : ` (${hf.name})`}`,
    amount: handleCount * unitHandle,
  });

  const metres = L.width / 1000;
  let accTotal = 0;
  const accNames: string[] = [];
  design.accessories.forEach((id) => {
    const a = getAccessory(id);
    if (!a || (a.hingedOnly && L.sliding)) return;
    const unitPrice = price(pricing.accessories, id, a.price);
    const qty = a.unit === "perShutter" ? L.doors.length : a.unit === "perMetre" ? metres : 1;
    accTotal += unitPrice * qty;
    accNames.push(a.name);
  });
  if (accNames.length) lines.push({ label: "Accessories", detail: accNames.join(", "), amount: accTotal });

  const totalFrontArea = sqft({ w: L.width, h: L.height });
  lines.push({
    label: "Installation",
    detail: `${f1(totalFrontArea)} sq.ft × ${g.currency}${g.installationPerSqft}`,
    amount: totalFrontArea * g.installationPerSqft,
  });
  if (g.otherCharges) lines.push({ label: g.otherChargesLabel || "Other charges", detail: "Flat", amount: g.otherCharges });

  lines.forEach((l) => (l.amount = Math.round(l.amount)));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = Math.round((subtotal * g.discountPct) / 100);
  const gst = Math.round(((subtotal - discount) * g.gstPct) / 100);
  return { lines, subtotal, discount, gst, total: subtotal - discount + gst, laminateAreas };
}

export function formatMoney(n: number, currency = "₹") {
  return `${currency}${Math.round(n).toLocaleString("en-IN")}`;
}
