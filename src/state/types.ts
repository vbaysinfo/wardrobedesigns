// Shared types for catalogue data and design state.

export type Range = [number, number];

export interface WardrobeModel {
  id: string;
  name: string;
  category: string;
  description: string;
  doorType: "hinged" | "sliding";
  defaults: { width: number; height: number; depth: number; loftHeight: number; shutterCount: number };
  limits: { width: Range; height: Range; depth: Range; loftHeight: Range; shutterCount: Range };
  /** "none" = no loft, "optional" = user may add one, "standard" = always has a loft. */
  loft: "none" | "optional" | "standard";
  /** External drawers. `columns` limits them to some shutter columns (default: all). */
  drawers: { rows: number; rowHeight: number; columns?: number[]; style?: string } | null;
  /** legs: raised on tapered legs; frame: thick solid-wood surround with a top cap. */
  decor: { cornice: boolean; plinth: boolean; legs?: boolean; frame?: boolean };
  /** Open shelving section beside the shutters. */
  openShelf?: { width: number; side: "left" | "right" } | null;
  defaultShutterStyle: string;
  /** Optional curated look applied when the model is chosen. */
  defaultDoors?: DoorOverride[];
  defaultMaterials?: Partial<Record<Surface, string>>;
  defaultHandle?: { style: string; finish: string };
  defaultAccessories?: string[];
  baseFactor: number;
}

export type TextureSpec =
  | { kind: "wood"; base: string; dark: string; light: string; rings: number; warp: number }
  | { kind: "solid"; base: string }
  | { kind: "linen"; base: string }
  | { kind: "concrete"; base: string }
  | { kind: "image"; src: string; tileMm?: number };

export interface Laminate {
  code: string;
  name: string;
  category: string;
  finish: string;
  color: string;
  pricePerSqft: number;
  texture: TextureSpec;
  /** Optional thumbnail image path; when absent the texture itself is used. */
  thumbnail?: string;
}

export interface ShutterStyle {
  id: string;
  name: string;
  description: string;
  ratePerSqft: number;
}

export interface HandleStyle {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface HandleFinish {
  id: string;
  name: string;
  colors: [string, string, string];
  priceFactor: number;
}

export interface Accessory {
  id: string;
  name: string;
  description: string;
  unit: "each" | "perShutter" | "perMetre";
  price: number;
  visual: boolean;
  hingedOnly?: boolean;
}

export interface ColorCombo {
  id: string;
  name: string;
  front: string;
  secondary: string;
  carcass: string;
  loft: string;
  drawer: string;
  handleStyle?: string;
  handleFinish?: string;
  shutterStyle?: string;
}

/** Surfaces that can carry their own laminate. */
export type Surface = "front" | "secondary" | "carcass" | "loft" | "drawer";

/** Per-shutter overrides; missing keys fall back to the design-wide value. */
export interface DoorOverride {
  style?: string;
  laminate?: string;
  secondary?: string;
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
  loftHeight: number;
}

export interface Design {
  name: string;
  modelId: string;
  dims: Dimensions;
  shutterCount: number;
  shutterStyle: string;
  materials: Record<Surface, string>;
  doors: DoorOverride[];
  handle: { style: string; finish: string };
  accessories: string[];
}

export interface PricingGeneral {
  currency: string;
  constructionPerSqft: number;
  loftPerSqft: number;
  drawerEach: number;
  laminateWastagePct: number;
  installationPerSqft: number;
  otherCharges: number;
  otherChargesLabel: string;
  discountPct: number;
  gstPct: number;
}

/** User-editable sample prices. Item maps hold overrides keyed by catalogue id/code. */
export interface PricingSettings {
  general: PricingGeneral;
  laminates: Record<string, number>;
  shutters: Record<string, number>;
  handles: Record<string, number>;
  accessories: Record<string, number>;
}

export interface SavedDesign {
  id: string;
  savedAt: string;
  design: Design;
}
