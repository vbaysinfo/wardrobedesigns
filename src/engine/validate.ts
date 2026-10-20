// Dimension checks. These are visual-design advisories, not engineering rules.
import { ABSOLUTE_LIMITS, getModel } from "../data/catalog";
import type { Design, Dimensions } from "../state/types";

export interface Advisory {
  level: "error" | "warning" | "info";
  field?: keyof Dimensions | "shutterCount";
  message: string;
}

const LABELS: Record<keyof Dimensions, string> = {
  width: "Width",
  height: "Height",
  depth: "Depth",
  loftHeight: "Loft height",
};

/** Validate raw text typed into a dimension field. Returns an error message or null. */
export function validateDimensionInput(field: keyof Dimensions, text: string): string | null {
  if (text.trim() === "") return `${LABELS[field]} is required.`;
  if (!/^\d+(\.\d+)?$/.test(text.trim())) return `${LABELS[field]} must be a positive number in millimetres.`;
  const n = Number(text);
  const [lo, hi] = ABSOLUTE_LIMITS[field];
  if (n < lo || n > hi) return `${LABELS[field]} must be between ${lo} and ${hi} mm.`;
  return null;
}

export function getAdvisories(design: Design): Advisory[] {
  const model = getModel(design.modelId);
  const out: Advisory[] = [];
  const { dims } = design;

  (["width", "height", "depth"] as const).forEach((f) => {
    const [lo, hi] = model.limits[f];
    if (dims[f] < lo || dims[f] > hi)
      out.push({
        level: "warning",
        field: f,
        message: `${LABELS[f]} ${dims[f]} mm is outside the ${model.name} template range (${lo}–${hi} mm). The preview is drawn at the nearest supported size.`,
      });
  });

  if (model.loft !== "none" && dims.loftHeight > 0) {
    const [lo, hi] = model.limits.loftHeight;
    const min = Math.max(lo, 300);
    if (dims.loftHeight < min || dims.loftHeight > hi)
      out.push({
        level: "warning",
        field: "loftHeight",
        message: `Loft height ${dims.loftHeight} mm is outside the supported range (${min}–${hi} mm). The preview is drawn at the nearest supported size.`,
      });
  }

  const usableWidth = Math.min(Math.max(dims.width, model.limits.width[0]), model.limits.width[1]);
  const perDoor = usableWidth / design.shutterCount;
  if (model.doorType === "hinged") {
    if (perDoor > 600)
      out.push({ level: "warning", field: "shutterCount", message: `Each shutter is about ${Math.round(perDoor)} mm wide. Hinged shutters wider than 600 mm may sag – consider more shutters.` });
    if (perDoor < 300)
      out.push({ level: "warning", field: "shutterCount", message: `Each shutter is only about ${Math.round(perDoor)} mm wide – consider fewer shutters.` });
    const doorH = Math.min(dims.height, model.limits.height[1]);
    if (doorH > 2400)
      out.push({ level: "info", field: "height", message: "Shutters taller than 2400 mm usually need a warp-control profile or a split shutter." });
  } else if (perDoor > 1200) {
    out.push({ level: "warning", field: "shutterCount", message: `Each sliding panel is about ${Math.round(perDoor)} mm wide. Panels over 1200 mm are heavy – consider adding a panel.` });
  }

  if (dims.depth < 550 && model.doorType === "hinged")
    out.push({ level: "info", field: "depth", message: "Depth under 550 mm may not fit standard hangers front-to-back." });

  return out;
}
