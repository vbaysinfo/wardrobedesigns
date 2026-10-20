// Laminate textures. Built-in laminates are generated procedurally in a canvas
// (seamless, deterministic, zero download); laminates with `texture.kind: "image"`
// load a local image file from /public. Every texture is cached as a PNG data URL
// so the SVG preview can be exported to PNG without cross-origin issues.
import { useSyncExternalStore } from "react";
import type { Laminate } from "../state/types";

export interface TextureInfo {
  url: string;
  /** Real-world size of one texture tile, in mm. */
  tileW: number;
  tileH: number;
}

const cache = new Map<string, TextureInfo>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Re-render subscribers whenever an async (image) texture finishes loading. */
export function useTextureVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
}

// ---- seeded noise -----------------------------------------------------------

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable 2D value noise with lattice periods px × py. */
function makeNoise(rand: () => number, px: number, py: number) {
  const grid = Float32Array.from({ length: px * py }, rand);
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = grid[y0 * px + x0], b = grid[y0 * px + x1];
    const c = grid[y1 * px + x0], d = grid[y1 * px + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const hex = (h: string) => {
  const v = parseInt(h.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ---- generators ---------------------------------------------------------------

function paint(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

function wood(lam: Laminate, spec: Extract<Laminate["texture"], { kind: "wood" }>): TextureInfo {
  const W = 256, H = 512;
  const rand = rng(hashString(lam.code));
  const warpN = makeNoise(rand, 3, 4);
  const fineN = makeNoise(rand, 96, 2);
  const midN = makeNoise(rand, 24, 1);
  const poreN = makeNoise(rand, 128, 24);
  const toneN = makeNoise(rand, 5, 2);
  const [br, bg, bb] = hex(spec.base), [dr, dg, db] = hex(spec.dark), [lr, lg, lb] = hex(spec.light);
  const rings = Math.max(2, Math.round(spec.rings));
  return {
    url: paint(W, H, (x, y) => {
      const u = x / W, v = y / H;
      // Gentle lateral drift keeps the grain mostly straight, like sliced veneer.
      const warp = (warpN(u * 3, v * 4) - 0.5) * spec.warp;
      const fine = fineN(u * 96 + warp * 2, v * 2) - 0.5;
      const mid = midN(u * 24 + warp * 1.2, v) - 0.5;
      const t = u * rings + warp * 0.35;
      const line = Math.pow(Math.abs(Math.sin(t * Math.PI)), 22);
      const pore = poreN(u * 128 + warp * 3, v * 24);
      const tone = toneN(u * 5, v * 2) - 0.5;
      let k = fine * 0.55 + mid * 0.7 + line * 0.5 + (pore > 0.78 ? (pore - 0.78) * 1.6 : 0) + tone * 0.25;
      k = Math.max(-0.8, Math.min(1, k));
      if (k >= 0) return [br + (dr - br) * k, bg + (dg - bg) * k, bb + (db - bb) * k];
      const m = -k;
      return [br + (lr - br) * m, bg + (lg - bg) * m, bb + (lb - bb) * m];
    }),
    tileW: 600,
    tileH: 1200,
  };
}

function solid(lam: Laminate, base: string, amount: number): TextureInfo {
  const rand = rng(hashString(lam.code));
  const [r, g, b] = hex(base);
  const n = makeNoise(rand, 32, 32);
  return {
    url: paint(128, 128, (x, y) => {
      const k = (n(x / 4, y / 4) - 0.5) * amount + (rand() - 0.5) * amount * 0.6;
      return [r + k, g + k, b + k];
    }),
    tileW: 300,
    tileH: 300,
  };
}

function linen(lam: Laminate, base: string): TextureInfo {
  const rand = rng(hashString(lam.code));
  const [r, g, b] = hex(base);
  const n = makeNoise(rand, 64, 64);
  const slub = makeNoise(rand, 8, 64);
  return {
    url: paint(256, 256, (x, y) => {
      const warpT = Math.sin((x / 256) * Math.PI * 2 * 64) * 6;
      const weftT = Math.sin((y / 256) * Math.PI * 2 * 64) * 6;
      const k = (warpT + weftT) * 0.5 + (n(x / 4, y / 4) - 0.5) * 14 + (slub(x / 32, y / 4) - 0.5) * 10;
      return [r + k, g + k, b + k];
    }),
    tileW: 200,
    tileH: 200,
  };
}

function concrete(lam: Laminate, base: string): TextureInfo {
  const rand = rng(hashString(lam.code));
  const [r, g, b] = hex(base);
  const n1 = makeNoise(rand, 4, 4), n2 = makeNoise(rand, 16, 16), n3 = makeNoise(rand, 64, 64);
  return {
    url: paint(256, 256, (x, y) => {
      const u = x / 256, v = y / 256;
      let k = (n1(u * 4, v * 4) - 0.5) * 34 + (n2(u * 16, v * 16) - 0.5) * 16 + (n3(u * 64, v * 64) - 0.5) * 10;
      if (rand() > 0.995) k -= 35; // air pockets
      return [r + k, g + k, b + k * 0.95];
    }),
    tileW: 900,
    tileH: 900,
  };
}

function loadImage(lam: Laminate, src: string, tileMm: number) {
  if (pending.has(lam.code)) return;
  pending.add(lam.code);
  const img = new Image();
  img.onload = () => {
    const size = Math.min(1024, Math.max(img.naturalWidth || 512, 64));
    const c = canvas(size, size);
    c.getContext("2d")!.drawImage(img, 0, 0, size, size);
    cache.set(lam.code, { url: c.toDataURL("image/png"), tileW: tileMm, tileH: tileMm });
    notify();
  };
  img.onerror = () => {
    // Missing asset: fall back to a flat colour so the visualiser keeps working.
    cache.set(lam.code, solid(lam, lam.color, 4));
    notify();
  };
  img.src = new URL(src, document.baseURI).href;
}

/** Return the texture for a laminate, generating it on first use. */
export function getTexture(lam: Laminate): TextureInfo {
  const hit = cache.get(lam.code);
  if (hit) return hit;
  const t = lam.texture;
  let info: TextureInfo;
  switch (t.kind) {
    case "wood":
      info = wood(lam, t);
      break;
    case "linen":
      info = linen(lam, t.base);
      break;
    case "concrete":
      info = concrete(lam, t.base);
      break;
    case "image":
      loadImage(lam, t.src, t.tileMm ?? 300);
      // Temporary flat colour until the image arrives (not cached).
      return solid(lam, lam.color, 0);
    default:
      info = solid(lam, t.base, lam.finish === "Gloss" ? 2 : 5);
  }
  cache.set(lam.code, info);
  return info;
}

/** Thumbnail URL for catalogue swatches. */
export function getThumbnail(lam: Laminate): string {
  if (lam.thumbnail) return new URL(lam.thumbnail, document.baseURI).href;
  return getTexture(lam).url;
}

/** Gloss overlay strength for a finish name (0 = none). */
export function finishSheen(finish: string): number {
  switch (finish) {
    case "Gloss":
      return 1;
    case "Suede":
      return 0.3;
    case "Matte":
      return 0.15;
    default:
      return 0.05;
  }
}
