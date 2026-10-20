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
  /** Tapered legs (front pair) when the model stands on legs. */
  legs: Rect[];
  /** Solid top cap of framed models. */
  cap: Rect | null;
  /** Open shelving section and its shelf y-positions. */
  shelf: { rect: Rect; shelves: number[] } | null;
  /** Visible carcass edge thickness for this model, mm. */
  edge: number;
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
const FRAME_EDGE = 42;
const LEG = 140;
const CAP = 32;

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
  const E = model.decor.frame ? FRAME_EDGE : EDGE;
  const onLegs = Boolean(model.decor.legs);

  const cornice = acc.has("cornice") ? { x: -20, y: 0, w: width + 40, h: CORNICE } : null;
  const cap = !cornice && model.decor.frame ? { x: -12, y: 0, w: width + 24, h: CAP } : null;
  let top = cornice ? CORNICE : cap ? CAP : 0;

  let loft: Layout["loft"] = null;
  if (loftHeight > 0) {
    const rect = { x: 0, y: top, w: width, h: loftHeight - top };
    const area = { x: E, y: rect.y + E, w: width - 2 * E, h: rect.h - 1.5 * E };
    const count = sliding ? Math.max(2, Math.round(area.w / 600)) : n;
    loft = { rect, doors: splitRow(area, count, hingedSides(count)) };
    top = loftHeight;
  }

  const legs: Rect[] = onLegs
    ? [
        { x: 30, y: height - LEG, w: 50, h: LEG },
        { x: width - 80, y: height - LEG, w: 50, h: LEG },
      ]
    : [];
  const baseY = height - (onLegs ? LEG : 0);
  const body = { x: 0, y: top, w: width, h: baseY - top };
  const plinth = acc.has("plinth") && !onLegs ? { x: 25, y: height - PLINTH, w: width - 50, h: PLINTH } : null;
  const bottom = baseY - (plinth ? PLINTH : 0) - E;
  const areaTop = body.y + (loft ? E / 2 : E);

  // Open shelving takes a column on one side, separated by a carcass divider.
  let areaX = E;
  let areaW = width - 2 * E;
  let shelf: Layout["shelf"] = null;
  if (model.openShelf && !sliding) {
    const sw = Math.min(model.openShelf.width, areaW * 0.4);
    const rect = { x: model.openShelf.side === "left" ? E : width - E - sw, y: areaTop, w: sw, h: bottom - areaTop };
    const count = Math.max(2, Math.round(rect.h / 380));
    const shelves = Array.from({ length: count - 1 }, (_, i) => rect.y + ((i + 1) * rect.h) / count);
    shelf = { rect, shelves };
    areaW -= sw + E;
    if (model.openShelf.side === "left") areaX += sw + E;
  }

  // External drawers sit in a band at the bottom, under all or some shutter columns.
  const drawers: Rect[] = [];
  let doorsBottom = bottom;
  const drawerCols = new Set<number>();
  if (model.drawers && !sliding) {
    const { rows, rowHeight } = model.drawers;
    const cols = (model.drawers.columns ?? Array.from({ length: n }, (_, i) => i)).filter((c) => c < n);
    const colW = (areaW - GAP * (n - 1)) / n;
    for (let r = 0; r < rows; r++) {
      const y = bottom - (r + 1) * rowHeight - r * GAP;
      for (const c of cols) drawers.push({ x: areaX + c * (colW + GAP), y, w: colW, h: rowHeight });
    }
    cols.forEach((c) => drawerCols.add(c));
    doorsBottom = bottom - rows * rowHeight - (rows - 1) * GAP - Math.min(E, 12) - GAP;
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
    // Shutters over drawers stop above them; the others run full height.
    const allDrawers = drawerCols.size === n;
    const fullBottom = allDrawers ? doorsBottom : bottom;
    doors = splitRow({ x: areaX, y: areaTop, w: areaW, h: fullBottom - areaTop }, n, hingedSides(n)).map((d) =>
      drawerCols.has(d.index) && !allDrawers ? { ...d, rect: { ...d.rect, h: doorsBottom - areaTop } } : d,
    );
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
    legs,
    cap,
    shelf,
    edge: E,
    tracks,
    interior: { x: areaX, y: areaTop, w: areaW, h: bottom - areaTop },
  };
}

const SQMM_PER_SQFT = 92903.04;
export const sqft = (r: Rect | { w: number; h: number }) => (r.w * r.h) / SQMM_PER_SQFT;
