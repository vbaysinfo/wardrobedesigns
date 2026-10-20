// Browser-side exports: PNG snapshot, JSON config, WhatsApp share text.
import { getAccessory, getHandleFinish, getHandleStyle, getLaminate, getModel, getShutterStyle } from "../data/catalog";
import { allPanelKeys, hasLoft, panelName, resolvePanel, sanitizeDesign } from "../state/design";
import type { Design, PricingSettings } from "../state/types";
import { formatMoney, type Quote } from "./quote";

export const EXPORT_APP = "wardrobe-studio";
export const EXPORT_SCHEMA = 1;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wardrobe";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Rasterise the live SVG preview (minus selection UI) into a PNG with a caption bar. */
export async function downloadPNG(svg: SVGSVGElement, design: Design, caption: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll(".ui-only").forEach((n) => n.remove());
  const vbw = Number(svg.dataset.vbw) || 1000;
  const vbh = Number(svg.dataset.vbh) || 1000;
  const scale = Math.min(2400 / vbw, 2400 / vbh, 1.2);
  const w = Math.round(vbw * scale);
  const h = Math.round(vbh * scale);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not render the preview image."));
      i.src = url;
    });
    const bar = Math.round(Math.max(70, w * 0.05));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h + bar;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.fillStyle = "#342619";
    ctx.fillRect(0, h, w, bar);
    ctx.fillStyle = "#f3eee7";
    ctx.font = `600 ${Math.round(bar * 0.32)}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(design.name, bar * 0.35, h + bar * 0.36);
    ctx.font = `${Math.round(bar * 0.22)}px system-ui, sans-serif`;
    ctx.fillStyle = "#d8c59c";
    ctx.fillText(caption, bar * 0.35, h + bar * 0.72);
    ctx.textAlign = "right";
    ctx.fillText("Visual estimate – not a manufacturing drawing", w - bar * 0.35, h + bar * 0.72);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("PNG export is not supported in this browser.");
    download(blob, `${slug(design.name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportJSON(design: Design, pricing: PricingSettings) {
  const payload = {
    app: EXPORT_APP,
    schemaVersion: EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    design,
    pricing,
  };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${slug(design.name)}.wardrobe.json`);
}

export interface ImportResult {
  design: Design;
  pricing: unknown;
  issues: string[];
}

/** Parse an exported file (or a bare design object). Throws with a readable message. */
export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!data || typeof data !== "object") throw new Error("This file does not contain a wardrobe design.");
  const obj = data as Record<string, unknown>;
  const rawDesign = obj.app === EXPORT_APP || "design" in obj ? obj.design : obj;
  if (!rawDesign || typeof rawDesign !== "object" || !("modelId" in (rawDesign as object)))
    throw new Error("No wardrobe design was found in this file.");
  const { design, issues } = sanitizeDesign(rawDesign);
  if (typeof obj.schemaVersion === "number" && obj.schemaVersion > EXPORT_SCHEMA)
    issues.unshift("This file was made by a newer version; some settings may be ignored.");
  return { design, pricing: obj.pricing, issues };
}

export function designSummaryLines(design: Design): [string, string][] {
  const model = getModel(design.modelId);
  const d = design.dims;
  const rows: [string, string][] = [
    ["Model", model.name],
    ["Size (W × H × D)", `${d.width} × ${d.height} × ${d.depth} mm`],
  ];
  if (hasLoft(design, model)) rows.push(["Loft height", `${d.loftHeight} mm`]);
  rows.push([model.doorType === "sliding" ? "Sliding panels" : "Shutters", String(design.shutterCount)]);
  rows.push(["Shutter style", getShutterStyle(design.shutterStyle).name]);
  rows.push(["Shutter laminate", `${getLaminate(design.materials.front).name} (${design.materials.front})`]);
  if (design.shutterStyle === "two-tone" || design.doors.some((o) => o.style === "two-tone"))
    rows.push(["Accent laminate", `${getLaminate(design.materials.secondary).name} (${design.materials.secondary})`]);
  rows.push(["Side panels", `${getLaminate(design.materials.carcass).name} (${design.materials.carcass})`]);
  if (hasLoft(design, model)) rows.push(["Loft laminate", `${getLaminate(design.materials.loft).name} (${design.materials.loft})`]);
  if (model.drawers) rows.push(["Drawer laminate", `${getLaminate(design.materials.drawer).name} (${design.materials.drawer})`]);
  const hs = getHandleStyle(design.handle.style);
  rows.push(["Handle", hs.id === "none" ? hs.name : `${hs.name} – ${getHandleFinish(design.handle.finish).name}`]);
  const acc = design.accessories.map((id) => getAccessory(id)?.name).filter(Boolean);
  rows.push(["Accessories", acc.length ? acc.join(", ") : "None"]);
  return rows;
}

/** One line per panel (shutter, loft shutter, drawer) that differs from the overall design. */
export function customDoorLines(design: Design): string[] {
  return allPanelKeys(design).flatMap((key) => {
    const r = resolvePanel(design, key);
    if (!r.overridden) return [];
    const parts = [getShutterStyle(r.style).name, getLaminate(r.laminate).name];
    if (r.style === "two-tone") parts.push(`accent ${getLaminate(r.secondary).name}`);
    return [`${panelName(key)}: ${parts.join(", ")}`];
  });
}

export function whatsappMessage(design: Design, quote: Quote, currency: string) {
  const lines = [
    `*${design.name}* – Wardrobe design`,
    ...designSummaryLines(design).map(([k, v]) => `• ${k}: ${v}`),
    ...customDoorLines(design).map((l) => `• ${l}`),
    `• Indicative estimate: ${formatMoney(quote.total, currency)} (incl. GST, to be verified)`,
    "",
    "Created with Wardrobe Studio. Visual estimate only – please confirm measurements and pricing.",
  ];
  return lines.join("\n");
}

export function whatsappLink(number: string, text: string) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
