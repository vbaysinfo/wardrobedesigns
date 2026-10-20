// Geometry engine: turns a Design into panel rectangles in millimetres.
// Origin is the top-left of the wardrobe, y grows downwards, floor is at y = height.
// Renderers (2D SVG today, potentially 3D later) consume this layout.
import { getModel } from "../data/catalog";
import { hasLoft } from "../state/design";
import type { Design } from "../state/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HandleSide = "left" | "right" | "center";

export interface DoorGeom {
  index: number;
  rect: Rect;
  handleSide: HandleSide;
  /** Sliding doors: 0 = rear track, 1 = front track. Hinged doors are always 1. */
  layer: 0 | 1;
}

export interface Layout {
  width: number;
  height: number;
  depth: number;
  loftHeight: number;
  bodyHeight: number;
  sliding: boolean;
  outer: Rect;
  cornice: Rect | null;
  loft: { rect: Rect; doors: DoorGeom[] } | null;
  body: Rect;
  doors: DoorGeom[];
  drawers: Rect[];
  plinth: Rect | null;
  tracks: Rect[];
  /** Interior area behind the shutters (used for glass doors). */
  interior: Rect;
}

export const EDGE = 12; // visible carcass edge, mm
export const GAP = 3; // reveal between shutters, mm
const CORNICE = 70;
const PLINTH = 100;
const TRACK = 38;
const OVERLAP = 40;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hingedSides(n: number): HandleSide[] {
  // Doors are paired from the left (meeting in the middle); an odd last door
  // is hinged on the right with its handle on the left.
  return Array.from({ length: n }, (_, i) => {
    if (i === n - 1 && n % 2 === 1) return "left";
    return i % 2 === 0 ? "right" : "left";
  });
}

function splitRow(area: Rect, n: number, sides: HandleSide[]): DoorGeom[] {
  const w = (area.w - GAP * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    rect: { x: area.x + i * (w + GAP), y: area.y, w, h: area.h },
    handleSide: sides[i],
    layer: 1,
  }));
}

export function computeLayout(design: Design): Layout {
  const model = getModel(design.modelId);
  const L = model.limits;
  const width = clamp(design.dims.width, L.width[0], L.width[1]);
  const bodyHeight = clamp(design.dims.height, L.height[0], L.height[1]);
  const depth = clamp(design.dims.depth, L.depth[0], L.depth[1]);
  const loftHeight = hasLoft(design, model)
    ? clamp(design.dims.loftHeight, Math.max(300, L.loftHeight[0]), Math.max(300, L.loftHeight[1]))
    : 0;
  const height = bodyHeight + loftHeight;
  const n = clamp(design.shutterCount, L.shutterCount[0], L.shutterCount[1]);
  const sliding = model.doorType === "sliding";
  const acc = new Set(design.accessories);

  const cornice = acc.has("cornice") ? { x: -20, y: 0, w: width + 40, h: CORNICE } : null;
  let top = cornice ? CORNICE : 0;

  let loft: Layout["loft"] = null;
  if (loftHeight > 0) {
    const rect = { x: 0, y: top, w: width, h: loftHeight - (cornice ? CORNICE : 0) };
    const area = { x: EDGE, y: rect.y + EDGE, w: width - 2 * EDGE, h: rect.h - 1.5 * EDGE };
    const count = sliding ? Math.max(2, Math.round(area.w / 600)) : n;
    loft = { rect, doors: splitRow(area, count, hingedSides(count)) };
    top = loftHeight;
  }

  const body = { x: 0, y: top, w: width, h: height - top };
  const plinth = acc.has("plinth") ? { x: 25, y: height - PLINTH, w: width - 50, h: PLINTH } : null;
  const bottom = height - (plinth ? PLINTH : 0) - EDGE;
  const areaX = EDGE;
  const areaW = width - 2 * EDGE;
  const areaTop = body.y + (loft ? EDGE / 2 : EDGE);

  // External drawers sit in a band at the bottom, one column per shutter.
  const drawers: Rect[] = [];
  let doorsBottom = bottom;
  if (model.drawers && !sliding) {
    const { rows, rowHeight } = model.drawers;
    const colW = (areaW - GAP * (n - 1)) / n;
    for (let r = 0; r < rows; r++) {
      const y = bottom - (r + 1) * rowHeight - r * GAP;
      for (let c = 0; c < n; c++) drawers.push({ x: areaX + c * (colW + GAP), y, w: colW, h: rowHeight });
    }
    doorsBottom = bottom - rows * rowHeight - (rows - 1) * GAP - EDGE;
  }

  const tracks: Rect[] = [];
  let doors: DoorGeom[];
  if (sliding) {
    tracks.push({ x: areaX, y: areaTop, w: areaW, h: TRACK }, { x: areaX, y: doorsBottom - TRACK, w: areaW, h: TRACK });
    const pw = (areaW + OVERLAP * (n - 1)) / n;
    const y = areaTop + TRACK * 0.55;
    const h = doorsBottom - TRACK * 0.55 - y;
    doors = Array.from({ length: n }, (_, i) => {
      const layer = (i % 2) as 0 | 1;
      let handleSide: HandleSide;
      if (layer === 1) handleSide = i === n - 1 ? "right" : "left";
      else handleSide = i === 0 ? "left" : i === n - 1 ? "right" : "center";
      return { index: i, rect: { x: areaX + i * (pw - OVERLAP), y, w: pw, h }, handleSide, layer };
    });
  } else {
    doors = splitRow({ x: areaX, y: areaTop, w: areaW, h: doorsBottom - areaTop }, n, hingedSides(n));
  }

  return {
    width,
    height,
    depth,
    loftHeight,
    bodyHeight,
    sliding,
    outer: { x: 0, y: 0, w: width, h: height },
    cornice,
    loft,
    body,
    doors,
    drawers,
    plinth,
    tracks,
    interior: { x: areaX, y: areaTop, w: areaW, h: doorsBottom - areaTop },
  };
}

const SQMM_PER_SQFT = 92903.04;
export const sqft = (r: Rect | { w: number; h: number }) => (r.w * r.h) / SQMM_PER_SQFT;
