// Layered 2D renderer. Draws the wardrobe as SVG in millimetre units:
// carcass → interior → shutters (style layer + laminate pattern + sheen) →
// handles → decor → lighting. Every laminate is an SVG <pattern> filled with a
// cached texture, so changing a material only swaps a fill – the geometry and
// panel positions stay fixed.
import { forwardRef, memo, useId, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { getHandleFinish, getLaminate, getModel } from "../data/catalog";
import { panelBadge, panelKey, parsePanelKey, resolvePanel } from "../state/design";
import type { Design } from "../state/types";
import { computeLayout, type DoorGeom, type HandleSide, type Rect } from "./layout";
import { finishSheen, getTexture, useTextureVersion } from "./textures";

export interface WardrobeSVGProps {
  design: Design;
  /** Rotation in degrees (-35…35). 0 = straight front elevation. */
  angle?: number;
  showDims?: boolean;
  /** Selected panel keys ("door:0", "loft:1", "drawer:2"). */
  selected?: string[];
  onPanelClick?: (key: string, additive: boolean) => void;
  className?: string;
  /** Hide wall/floor context (thumbnails). */
  bare?: boolean;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const WardrobeSVG = memo(
  forwardRef<SVGSVGElement, WardrobeSVGProps>(function WardrobeSVG(
    { design, angle = 0, showDims = false, selected = [], onPanelClick, className, bare = false },
    ref,
  ) {
    useTextureVersion();
    const p = "w" + useId().replace(/[^a-zA-Z0-9]/g, "");
    const model = getModel(design.modelId);
    const L = computeLayout(design);
    const { width: W, height: H, depth: D } = L;
    const acc = new Set(design.accessories);
    const led = acc.has("led-profile");
    const finish = getHandleFinish(design.handle.finish);
    const handleStyle = design.handle.style;

    // ---- materials ---------------------------------------------------------
    const used = new Set<string>(Object.values(design.materials));
    const allKeys = [
      ...L.doors.map((d) => panelKey("door", d.index)),
      ...(L.loft?.doors ?? []).map((d) => panelKey("loft", d.index)),
      ...L.drawers.map((_, i) => panelKey("drawer", i)),
    ];
    const resolved = new Map(allKeys.map((k) => [k as string, resolvePanel(design, k)]));
    resolved.forEach((r) => {
      used.add(r.laminate);
      used.add(r.secondary);
    });
    // Cane infill always uses the cane texture, whatever the shutter laminate.
    const CANE = "TX-403";
    if ([...resolved.values()].some((r) => r.style === "cane")) used.add(CANE);
    const fill = (code: string) => `url(#${p}-lam-${code})`;
    const sheen = (code: string) => finishSheen(getLaminate(code).finish);

    // ---- projection --------------------------------------------------------
    const a = Math.max(-35, Math.min(35, angle));
    const rad = (Math.abs(a) * Math.PI) / 180;
    const cx = Math.cos(rad);
    const sw = D * Math.sin(rad) * 0.95; // side panel projected width
    const sideRight = a > 0;
    const frontX = a < 0 ? sw : 0;
    const totalW = W * cx + (a !== 0 ? sw : 0);

    const fs = Math.max(W, H) * 0.024;
    const padX = Math.max(W, H) * 0.12 + (showDims ? fs * 3 : 0);
    const padTop = Math.max(W, H) * 0.08 + (showDims ? fs * 1.5 : 0);
    const padBottom = Math.max(W, H) * 0.07 + (showDims ? fs * 3.2 : 0);
    const vb = { x: -padX, y: -padTop, w: totalW + padX * 2, h: H + padTop + padBottom };

    // ---- building blocks -------------------------------------------------------
    const panelBase = (r: Rect, lam: string, key: string, extra?: ReactNode) => (
      <g key={key}>
        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill(lam)} />
        {extra}
        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${p}-gloss)`} opacity={sheen(lam)} />
        <rect x={r.x + 0.75} y={r.y + 0.75} width={r.w - 1.5} height={r.h - 1.5} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth={1.5} />
        <line x1={r.x + 2} y1={r.y + 1.5} x2={r.x + r.w - 2} y2={r.y + 1.5} stroke="rgba(255,255,255,.35)" strokeWidth={1.5} />
      </g>
    );

    const bevel = (d: string, depth = 1) => (
      <>
        <path d={d} fill="rgba(0,0,0,.05)" />
        <path d={d} fill="none" stroke="rgba(0,0,0,.30)" strokeWidth={5 * depth} transform="translate(1.5 1.5)" />
        <path d={d} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={2.5 * depth} transform="translate(-1.5 -1.5)" />
      </>
    );

    const rectPath = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

    function shutter(r: Rect, style: string, lam: string, sec: string, key: string): ReactNode {
      const { x, y, w, h } = r;
      switch (style) {
        case "fluted": {
          const count = Math.max(4, Math.round(w / 32));
          const fw = w / count;
          return panelBase(
            r,
            lam,
            key,
            <g>
              {Array.from({ length: count }, (_, i) => (
                <rect key={i} x={x + i * fw} y={y} width={fw} height={h} fill={`url(#${p}-flute)`} />
              ))}
            </g>,
          );
        }
        case "framed": {
          const f = Math.min(70, Math.min(w, h) * 0.14);
          return panelBase(r, lam, key, bevel(rectPath(x + f, y + f, w - 2 * f, h - 2 * f)));
        }
        case "shaker": {
          const f = Math.min(95, Math.min(w, h) * 0.19);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          return panelBase(
            r,
            lam,
            key,
            <>
              <rect x={ix} y={iy} width={iw} height={ih} fill="rgba(0,0,0,.08)" />
              <rect x={ix} y={iy} width={iw} height={14} fill={`url(#${p}-shadeDown)`} />
              <rect x={ix} y={iy} width={12} height={ih} fill={`url(#${p}-shadeRight)`} />
              <path d={`M${ix} ${iy + ih}H${ix + iw}V${iy}`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={3} />
              <path d={`M${ix} ${iy + ih}V${iy}H${ix + iw}`} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={3} />
            </>,
          );
        }
        case "arch": {
          const f = Math.min(80, Math.min(w, h) * 0.15);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          const ry = Math.min(iw / 2, ih * 0.3);
          const arch = (inset: number) => {
            const ax = ix + inset, aw = iw - 2 * inset, ay = iy + inset, ah = ih - 2 * inset, ary = Math.max(0, ry - inset * 0.5);
            return `M${ax} ${ay + ah}V${ay + ary}A${aw / 2} ${ary} 0 0 1 ${ax + aw} ${ay + ary}V${ay + ah}Z`;
          };
          return panelBase(
            r,
            lam,
            key,
            <>
              {bevel(arch(0), 1.2)}
              <path d={arch(20)} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth={2.5} />
              <path d={arch(22)} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.5} />
            </>,
          );
        }
        case "mirror": {
          const b = Math.min(32, w * 0.06);
          const mx = x + b, my = y + b, mw = w - 2 * b, mh = h - 2 * b;
          return panelBase(
            r,
            lam,
            key,
            <>
              <rect x={mx} y={my} width={mw} height={mh} fill={`url(#${p}-mirror)`} />
              <path d={`M${mx + mw * 0.15} ${my}L${mx + mw * 0.5} ${my}L${mx} ${my + mh * 0.45}L${mx} ${my + mh * 0.2}Z`} fill="rgba(255,255,255,.35)" />
              <path d={`M${mx + mw} ${my + mh * 0.3}L${mx + mw} ${my + mh * 0.42}L${mx + mw * 0.35} ${my + mh}L${mx + mw * 0.22} ${my + mh}Z`} fill="rgba(255,255,255,.2)" />
              <rect x={mx} y={my} width={mw} height={mh} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth={2} />
            </>,
          );
        }
        case "glass":
        case "reeded-glass":
          return glassDoor(r, key, style === "reeded-glass");
        case "cane": {
          const f = Math.min(65, Math.min(w, h) * 0.13);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          const bar = Math.min(40, iw * 0.12);
          const cols: [number, number][] = iw > 280 ? [[ix, (iw - bar) / 2], [ix + (iw + bar) / 2, (iw - bar) / 2]] : [[ix, iw]];
          const cuts = ih > 900 ? [iy + ih * 0.17, iy + ih * 0.83] : [];
          const edges = [iy, ...cuts.flatMap((c) => [c - bar / 2, c + bar / 2]), iy + ih];
          const rows: [number, number][] = [];
          for (let i = 0; i < edges.length; i += 2) rows.push([edges[i], edges[i + 1] - edges[i]]);
          return panelBase(
            r,
            lam,
            key,
            <>
              {cols.flatMap(([cxp, cw], ci) =>
                rows.map(([ry, rh], ri) => (
                  <g key={`${ci}-${ri}`}>
                    <rect x={cxp} y={ry} width={cw} height={rh} fill={fill(CANE)} />
                    <rect x={cxp} y={ry} width={cw} height={rh} fill="rgba(255,236,200,.06)" />
                    <path d={`M${cxp} ${ry + rh}V${ry}H${cxp + cw}`} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={6} />
                    <path d={`M${cxp} ${ry + rh}H${cxp + cw}V${ry}`} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={3} />
                  </g>
                )),
              )}
            </>,
          );
        }
        case "mirror-arch": {
          const f = Math.min(60, Math.min(w, h) * 0.12);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          const ry = Math.min(iw / 2, ih * 0.22);
          const d = `M${ix} ${iy + ih}V${iy + ry}A${iw / 2} ${ry} 0 0 1 ${ix + iw} ${iy + ry}V${iy + ih}Z`;
          const clipId = `${p}-mclip-${key}`;
          return panelBase(
            r,
            lam,
            key,
            <>
              <clipPath id={clipId}>
                <path d={d} />
              </clipPath>
              <g clipPath={`url(#${clipId})`}>
                <rect x={ix} y={iy} width={iw} height={ih} fill={`url(#${p}-mirror)`} />
                <path d={`M${ix + iw * 0.2} ${iy}L${ix + iw * 0.6} ${iy}L${ix} ${iy + ih * 0.5}L${ix} ${iy + ih * 0.25}Z`} fill="rgba(255,255,255,.35)" />
                <path d={`M${ix + iw} ${iy + ih * 0.35}L${ix + iw} ${iy + ih * 0.47}L${ix + iw * 0.35} ${iy + ih}L${ix + iw * 0.2} ${iy + ih}Z`} fill="rgba(255,255,255,.2)" />
              </g>
              {bevel(d, 1.1)}
            </>,
          );
        }
        case "louvered": {
          const f = Math.min(60, Math.min(w, h) * 0.12);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          const rail = 70;
          const sections: [number, number][] = ih > 1100 ? [[iy, (ih - rail) / 2], [iy + (ih + rail) / 2, (ih - rail) / 2]] : [[iy, ih]];
          return panelBase(
            r,
            lam,
            key,
            <>
              {sections.map(([sy, sh], si) => {
                const count = Math.max(3, Math.round(sh / 42));
                const pitch = sh / count;
                return (
                  <g key={si}>
                    <rect x={ix} y={sy} width={iw} height={sh} fill="rgba(0,0,0,.35)" />
                    {Array.from({ length: count }, (_, k) => (
                      <g key={k}>
                        <rect x={ix} y={sy + k * pitch} width={iw} height={pitch * 0.92} fill={fill(lam)} />
                        <rect x={ix} y={sy + k * pitch} width={iw} height={pitch * 0.92} fill={`url(#${p}-slat)`} />
                      </g>
                    ))}
                    {bevel(rectPath(ix, sy, iw, sh))}
                  </g>
                );
              })}
            </>,
          );
        }
        case "raised-panel": {
          const f = Math.min(85, Math.min(w, h) * 0.16);
          const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
          const upper = (ih - f) * 0.62;
          const sections: [number, number][] = ih > 900 ? [[iy, upper], [iy + upper + f, ih - upper - f]] : [[iy, ih]];
          return panelBase(
            r,
            lam,
            key,
            <>
              {sections.map(([sy, sh], si) => {
                const t = Math.min(38, iw * 0.15, sh * 0.15);
                return (
                  <g key={si}>
                    {bevel(rectPath(ix, sy, iw, sh), 1.2)}
                    <rect x={ix + t} y={sy + t} width={iw - 2 * t} height={sh - 2 * t} fill="rgba(255,255,255,.05)" />
                    <path d={`M${ix + t} ${sy + sh - t}V${sy + t}H${ix + iw - t}`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={3} />
                    <path d={`M${ix + t} ${sy + sh - t}H${ix + iw - t}V${sy + t}`} fill="none" stroke="rgba(0,0,0,.3)" strokeWidth={3} />
                    <path d={`M${ix} ${sy}L${ix + t} ${sy + t}M${ix + iw} ${sy}L${ix + iw - t} ${sy + t}M${ix} ${sy + sh}L${ix + t} ${sy + sh - t}M${ix + iw} ${sy + sh}L${ix + iw - t} ${sy + sh - t}`} stroke="rgba(0,0,0,.18)" strokeWidth={2} />
                  </g>
                );
              })}
            </>,
          );
        }
        case "two-tone": {
          const split = y + h * 0.4;
          return (
            <g key={key}>
              {panelBase({ x, y: split, w, h: y + h - split }, lam, key + "b")}
              {panelBase({ x, y, w, h: split - y }, sec, key + "a")}
              <line x1={x} y1={split} x2={x + w} y2={split} stroke="rgba(0,0,0,.4)" strokeWidth={4} />
            </g>
          );
        }
        default:
          return panelBase(r, lam, key);
      }
    }

    function glassDoor(r: Rect, key: string, reeded: boolean): ReactNode {
      const { x, y, w, h } = r;
      const f = 22;
      const gx = x + f, gy = y + f, gw = w - 2 * f, gh = h - 2 * f;
      const clipId = `${p}-gclip-${key}`;
      const reeds = reeded ? Math.max(6, Math.round(gw / 16)) : 0;
      return (
        <g key={key}>
          <rect x={x} y={y} width={w} height={h} fill={`url(#${p}-hfH)`} />
          <rect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h - 1.5} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={1.5} />
          <clipPath id={clipId}>
            <rect x={gx} y={gy} width={gw} height={gh} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <use href={`#${p}-interior`} />
            <rect x={gx} y={gy} width={gw} height={gh} fill={reeded ? "rgba(120,100,80,.45)" : "rgba(70,52,36,.42)"} />
            {led && <rect x={gx} y={gy} width={gw} height={gh * 0.5} fill={`url(#${p}-ledGlow)`} />}
            {Array.from({ length: reeds }, (_, i) => (
              <rect key={i} x={gx + (i * gw) / reeds} y={gy} width={gw / reeds} height={gh} fill={`url(#${p}-flute)`} />
            ))}
            {reeded && <rect x={gx} y={gy} width={gw} height={gh} fill="rgba(255,255,255,.12)" />}
            <rect x={gx} y={gy} width={gw} height={gh} fill={`url(#${p}-gloss)`} opacity={0.9} />
          </g>
          <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={2} />
        </g>
      );
    }

    function handle(r: Rect, side: HandleSide, kind: "door" | "drawer" | "loft", key: string): ReactNode {
      if (handleStyle === "none") return null;
      const vFill = `url(#${p}-hfH)`; // gradient across a vertical bar
      const hFill = `url(#${p}-hfV)`; // gradient across a horizontal bar
      const shadow = `url(#${p}-hshadow)`;
      if (handleStyle === "profile") {
        const t = 24;
        if (kind === "door") {
          const hx = side === "right" ? r.x + r.w - t : r.x;
          return (
            <g key={key} filter={shadow}>
              <rect x={hx} y={r.y} width={t} height={r.h} fill={vFill} />
              <rect x={side === "right" ? hx + 4 : hx + t - 9} y={r.y} width={5} height={r.h} fill="rgba(0,0,0,.45)" />
            </g>
          );
        }
        const hy = kind === "drawer" ? r.y : r.y + r.h - t;
        return (
          <g key={key} filter={shadow}>
            <rect x={r.x} y={hy} width={r.w} height={t} fill={hFill} />
            <rect x={r.x} y={kind === "drawer" ? hy + t - 9 : hy + 4} width={r.w} height={5} fill="rgba(0,0,0,.45)" />
          </g>
        );
      }
      const long = handleStyle === "bar-long";
      if (kind === "door") {
        const len = long ? Math.min(600, r.h * 0.4) : 160;
        const t = long ? 18 : 15;
        const inset = 55;
        const hx = side === "right" ? r.x + r.w - inset - t : side === "left" ? r.x + inset : r.x + r.w / 2 - t / 2;
        const cy = Math.min(Math.max(H - 1050, r.y + len / 2 + 60), r.y + r.h - len / 2 - 60);
        return <rect key={key} x={hx} y={cy - len / 2} width={t} height={len} rx={t / 2} fill={vFill} filter={shadow} />;
      }
      const len = long ? Math.min(kind === "drawer" ? 420 : 320, r.w * 0.5) : 128;
      const t = long ? 16 : 14;
      let hx = r.x + r.w / 2 - len / 2;
      let hy = r.y + Math.min(60, r.h * 0.28);
      if (kind === "loft") {
        hy = r.y + r.h - 55;
        hx = side === "right" ? r.x + r.w - 60 - len : side === "left" ? r.x + 60 : hx;
      }
      return <rect key={key} x={hx} y={hy} width={len} height={t} rx={t / 2} fill={hFill} filter={shadow} />;
    }

    // ---- interior (seen through glass shutters) ------------------------------
    const I = L.interior;
    const interiorScene = (
      <g id={`${p}-interior`}>
        <rect x={I.x} y={I.y} width={I.w} height={I.h} fill="#3a2d22" />
        <rect x={I.x} y={I.y} width={I.w} height={I.h} fill={fill(design.materials.carcass)} opacity={0.35} />
        {[0.2, 0.62, 0.8].map((k) => (
          <rect key={k} x={I.x} y={I.y + I.h * k} width={I.w} height={18} fill="rgba(255,255,255,.18)" />
        ))}
        <rect x={I.x} y={I.y + I.h * 0.2 + 70} width={I.w} height={10} rx={5} fill="#b9bcbf" opacity={0.7} />
        {Array.from({ length: Math.floor(I.w / 70) }, (_, i) => {
          const colors = ["#6b5a4a", "#8c7b6b", "#4c5560", "#a4917a", "#5e4a3b", "#7d6c5f"];
          const len = I.h * (0.28 + ((i * 37) % 11) / 60);
          return (
            <rect key={i} x={I.x + 20 + i * 70} y={I.y + I.h * 0.2 + 85} width={52} height={len} rx={10} fill={colors[i % colors.length]} opacity={0.8} />
          );
        })}
        {Array.from({ length: Math.floor(I.w / 160) }, (_, i) => (
          <rect key={i} x={I.x + 30 + i * 160} y={I.y + I.h * 0.62 - 110} width={120} height={110} rx={6} fill={i % 2 ? "#9a8a76" : "#6d6156"} opacity={0.7} />
        ))}
      </g>
    );

    // ---- assemble --------------------------------------------------------------
    const doors = [...L.doors].sort((da, db) => da.layer - db.layer);

    const clickable = (key: string) =>
      onPanelClick
        ? {
            className: "ws-door",
            onClick: (e: ReactMouseEvent) => {
              e.stopPropagation();
              onPanelClick(key, e.shiftKey || e.metaKey || e.ctrlKey);
            },
          }
        : {};
    const hit = (r: Rect) => <rect className="ws-door-hit" x={r.x} y={r.y} width={r.w} height={r.h} fill="transparent" />;

    const doorNode = (d: DoorGeom) => {
      const key = panelKey("door", d.index);
      const r = resolved.get(key)!;
      return (
        <g key={key} data-panel={key} filter={L.sliding && d.layer === 1 ? `url(#${p}-slideShadow)` : undefined} {...clickable(key)}>
          {shutter(d.rect, r.style, r.laminate, r.secondary, "s" + d.index)}
          {L.sliding && d.layer === 0 && <rect x={d.rect.x} y={d.rect.y} width={d.rect.w} height={d.rect.h} fill="rgba(0,0,0,.08)" />}
          {!r.style.includes("glass") || handleStyle !== "profile" ? handle(d.rect, d.handleSide, "door", "h" + d.index) : null}
          {hit(d.rect)}
        </g>
      );
    };

    // Every selectable panel rectangle, for selection outlines.
    const panelRects = new Map<string, Rect>([
      ...L.doors.map((d) => [panelKey("door", d.index), d.rect] as [string, Rect]),
      ...(L.loft?.doors ?? []).map((d) => [panelKey("loft", d.index), d.rect] as [string, Rect]),
      ...L.drawers.map((r, i) => [panelKey("drawer", i), r] as [string, Rect]),
    ]);

    const Hb = L.body.y + L.body.h; // underside of the carcass (above legs)

    // Open shelving with a few styling props.
    const shelfNode = L.shelf && (() => {
      const S = L.shelf.rect;
      const bounds = [S.y, ...L.shelf.shelves, S.y + S.h];
      return (
        <g>
          <rect x={S.x} y={S.y} width={S.w} height={S.h} fill="#3a2d22" />
          <rect x={S.x} y={S.y} width={S.w} height={S.h} fill={fill(design.materials.carcass)} opacity={0.55} />
          <rect x={S.x} y={S.y} width={S.w} height={S.h} fill="rgba(0,0,0,.18)" />
          <rect x={S.x} y={S.y} width={14} height={S.h} fill="rgba(0,0,0,.18)" />
          {bounds.slice(0, -1).map((top, i) => {
            const bottom = bounds[i + 1];
            const base = bottom - (i < bounds.length - 2 ? 9 : 0);
            const kind = i % 3;
            return (
              <g key={i}>
                <rect x={S.x} y={top} width={S.w} height={22} fill="rgba(0,0,0,.18)" />
                {kind === 0 &&
                  Array.from({ length: Math.max(3, Math.floor((S.w * 0.6) / 34)) }, (_, k) => {
                    const bh = Math.min(bottom - top - 60, 210 + ((k * 53) % 70));
                    return <rect key={k} x={S.x + 30 + k * 34} y={base - bh} width={30} height={bh} fill={["#7c5c43", "#a49480", "#5a6b70", "#c2a878", "#6d4e3a"][k % 5]} />;
                  })}
                {kind === 1 && (
                  <>
                    <path d={`M${S.x + S.w * 0.35 - 55} ${base}L${S.x + S.w * 0.35 - 70} ${base - 150}H${S.x + S.w * 0.35 + 70}L${S.x + S.w * 0.35 + 55} ${base}Z`} fill="#e7dfd3" />
                    <ellipse cx={S.x + S.w * 0.35} cy={base - 200} rx={85} ry={70} fill="#7d8f6a" />
                    <rect x={S.x + S.w * 0.62} y={base - 70} width={S.w * 0.28} height={70} rx={6} fill="#cbbba3" />
                  </>
                )}
                {kind === 2 &&
                  [0, 1, 2].map((k) => (
                    <rect key={k} x={S.x + S.w * 0.15} y={base - (k + 1) * 45} width={S.w * 0.65} height={42} rx={10} fill={["#d8cdbd", "#9fa8a3", "#b99c80"][k]} />
                  ))}
              </g>
            );
          })}
          {L.shelf.shelves.map((sy, i) => (
            <g key={"sh" + i}>
              <rect x={S.x} y={sy - 9} width={S.w} height={18} fill={fill(design.materials.carcass)} />
              <rect x={S.x} y={sy - 9} width={S.w} height={3} fill="rgba(255,255,255,.3)" />
              <rect x={S.x} y={sy + 9} width={S.w} height={10} fill="rgba(0,0,0,.25)" />
            </g>
          ))}
        </g>
      );
    })();

    const front = (
      <g transform={`translate(${frontX} 0) scale(${cx} 1)`}>
        {/* carcass */}
        <rect x={0} y={L.body.y} width={W} height={L.body.h} fill={fill(design.materials.carcass)} />
        {L.loft && <rect x={0} y={L.loft.rect.y} width={W} height={L.loft.rect.h} fill={fill(design.materials.carcass)} />}
        <rect x={0} y={0} width={W} height={Hb} fill="rgba(0,0,0,.06)" />
        <rect x={I.x} y={I.y} width={I.w} height={I.h} fill="#241b14" />
        {shelfNode}
        {L.tracks.map((t, i) => (
          <rect key={"t" + i} x={t.x} y={t.y} width={t.w} height={t.h} fill={`url(#${p}-alu)`} />
        ))}
        {doors.map(doorNode)}
        {L.drawers.map((r, i) => {
          const key = panelKey("drawer", i);
          const rs = resolved.get(key)!;
          return (
            <g key={key} data-panel={key} {...clickable(key)}>
              {shutter(r, rs.style, rs.laminate, rs.secondary, "d" + i)}
              {handle(r, "center", "drawer", "dh" + i)}
              {hit(r)}
            </g>
          );
        })}
        {L.loft &&
          L.loft.doors.map((d) => {
            const key = panelKey("loft", d.index);
            const rs = resolved.get(key)!;
            return (
              <g key={key} data-panel={key} {...clickable(key)}>
                {shutter(d.rect, rs.style, rs.laminate, rs.secondary, "l" + d.index)}
                {!rs.style.includes("glass") || handleStyle !== "profile" ? handle(d.rect, d.handleSide, "loft", "lh" + d.index) : null}
                {hit(d.rect)}
              </g>
            );
          })}
        {L.plinth && (
          <>
            <rect x={0} y={L.plinth.y} width={W} height={L.plinth.h} fill={fill(design.materials.carcass)} />
            <rect x={L.plinth.x} y={L.plinth.y} width={L.plinth.w} height={L.plinth.h} fill="rgba(0,0,0,.42)" />
            <rect x={L.plinth.x} y={L.plinth.y} width={L.plinth.w} height={10} fill="rgba(0,0,0,.25)" />
          </>
        )}
        {L.legs.map((g, i) => (
          <g key={"leg" + i}>
            <path d={`M${g.x} ${g.y}H${g.x + g.w}L${g.x + g.w * 0.78} ${g.y + g.h}H${g.x + g.w * 0.22}Z`} fill={fill(design.materials.carcass)} />
            <path d={`M${g.x} ${g.y}H${g.x + g.w}L${g.x + g.w * 0.78} ${g.y + g.h}H${g.x + g.w * 0.22}Z`} fill="rgba(0,0,0,.22)" />
            <rect x={g.x + g.w * 0.21} y={g.y + g.h - 26} width={g.w * 0.58} height={26} fill={`url(#${p}-hfH)`} />
          </g>
        ))}
        {L.cap && (
          <g>
            <rect x={L.cap.x} y={0} width={L.cap.w} height={L.cap.h} fill={fill(design.materials.carcass)} />
            <rect x={L.cap.x} y={0} width={L.cap.w} height={4} fill="rgba(255,255,255,.3)" />
            <rect x={L.cap.x} y={L.cap.h - 4} width={L.cap.w} height={4} fill="rgba(0,0,0,.3)" />
            <rect x={0} y={L.cap.h} width={W} height={10} fill="rgba(0,0,0,.18)" />
          </g>
        )}
        {L.cornice && (
          <g>
            <rect x={L.cornice.x} y={0} width={L.cornice.w} height={L.cornice.h} fill={fill(design.materials.carcass)} />
            <rect x={L.cornice.x} y={0} width={L.cornice.w} height={L.cornice.h} fill={`url(#${p}-cornice)`} />
          </g>
        )}
        {led && (
          <>
            <rect x={I.x} y={I.y - 4} width={I.w} height={6} fill="#fff4d6" />
            <rect x={I.x} y={I.y} width={I.w} height={Math.min(420, I.h * 0.35)} fill={`url(#${p}-ledGlow)`} opacity={0.55} style={{ mixBlendMode: "screen" }} />
          </>
        )}
        <rect x={0} y={0} width={W} height={Hb} fill={`url(#${p}-light)`} pointerEvents="none" />
        <rect x={0} y={L.cap ? L.cap.h : 0} width={W} height={Hb - (L.cap ? L.cap.h : 0)} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={2} />
        {/* selection (UI only, removed from exports) */}
        <g className="ui-only" pointerEvents="none">
          {selected.map((key) => {
            const r = panelRects.get(key);
            if (!r) return null;
            const rad = Math.min(48, r.w * 0.2, r.h * 0.3);
            const cy = r.y + Math.min(90, r.h / 2);
            return (
              <g key={"sel" + key}>
                <rect x={r.x + 4} y={r.y + 4} width={r.w - 8} height={r.h - 8} fill="rgba(171,132,56,.14)" stroke="#ab8438" strokeWidth={8} strokeDasharray="28 14" />
                <circle cx={r.x + r.w / 2} cy={cy} r={rad} fill="#ab8438" />
                <text x={r.x + r.w / 2} y={cy} dy="0.35em" textAnchor="middle" fontFamily={FONT} fontSize={rad * (parsePanelKey(key)?.part === "door" ? 1.08 : 0.8)} fontWeight={700} fill="#fff">
                  {panelBadge(key)}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    );

    // Side panel (perspective views)
    let side: ReactNode = null;
    if (a !== 0 && sw > 1) {
      const nearX = sideRight ? W * cx : frontX;
      const farX = sideRight ? nearX + sw : 0;
      const topDrop = sw * 0.1;
      const botRise = sw * 0.05;
      const pts = `${nearX},0 ${farX},${topDrop} ${farX},${Hb - botRise} ${nearX},${Hb}`;
      side = (
        <g>
          <polygon points={pts} fill={fill(design.materials.carcass)} />
          <polygon points={pts} fill={`url(#${p}-sideShade)`} />
          {L.cornice && (
            <polygon points={`${nearX},0 ${farX},${topDrop} ${farX},${topDrop + 60} ${nearX},${70}`} fill="rgba(0,0,0,.18)" />
          )}
          {L.plinth && (
            <polygon points={`${nearX},${H - 100} ${farX},${H - botRise - 95} ${farX},${H - botRise} ${nearX},${H}`} fill="rgba(0,0,0,.25)" />
          )}
          {L.loft && (
            <line x1={nearX} y1={L.loft.rect.y + L.loft.rect.h} x2={farX} y2={topDrop + (L.loft.rect.y + L.loft.rect.h) * (1 - (topDrop + botRise) / H)} stroke="rgba(0,0,0,.25)" strokeWidth={3} />
          )}
          <polygon points={pts} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={2} />
        </g>
      );
    }

    // Dimension annotations
    let dims: ReactNode = null;
    if (showDims) {
      const col = "#5a4a3a";
      const tick = fs * 0.5;
      const yW = H + fs * 1.6;
      const x0 = frontX, x1 = frontX + W * cx;
      const xH = -fs * 1.6;
      const seg = (y0: number, y1: number, x: number, label: string) => (
        <g>
          <line x1={x} y1={y0} x2={x} y2={y1} stroke={col} strokeWidth={fs * 0.06} />
          <line x1={x - tick} y1={y0} x2={x + tick} y2={y0} stroke={col} strokeWidth={fs * 0.06} />
          <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={col} strokeWidth={fs * 0.06} />
          <text x={x - fs * 0.4} y={(y0 + y1) / 2} fontFamily={FONT} fontSize={fs * 0.85} fill={col} textAnchor="middle" transform={`rotate(-90 ${x - fs * 0.4} ${(y0 + y1) / 2})`}>
            {label}
          </text>
        </g>
      );
      // Chain dimension of shutter widths above the unit (CAD-style).
      const yC = -fs * 1.5;
      const chain = L.sliding ? [] : L.doors.map((d) => d.rect);
      const sx = (x: number) => frontX + x * cx;
      dims = (
        <g className="dims">
          {chain.map((r, i) => (
            <g key={"c" + i}>
              <line x1={sx(r.x)} y1={yC} x2={sx(r.x + r.w)} y2={yC} stroke={col} strokeWidth={fs * 0.05} />
              <line x1={sx(r.x)} y1={yC - tick * 0.7} x2={sx(r.x)} y2={yC + tick * 0.7} stroke={col} strokeWidth={fs * 0.05} />
              <line x1={sx(r.x + r.w)} y1={yC - tick * 0.7} x2={sx(r.x + r.w)} y2={yC + tick * 0.7} stroke={col} strokeWidth={fs * 0.05} />
              <text x={sx(r.x + r.w / 2)} y={yC - fs * 0.35} fontFamily={FONT} fontSize={fs * 0.7} fill={col} textAnchor="middle">
                {Math.round(r.w)}
              </text>
            </g>
          ))}
          <line x1={x0} y1={yW} x2={x1} y2={yW} stroke={col} strokeWidth={fs * 0.06} />
          <line x1={x0} y1={yW - tick} x2={x0} y2={yW + tick} stroke={col} strokeWidth={fs * 0.06} />
          <line x1={x1} y1={yW - tick} x2={x1} y2={yW + tick} stroke={col} strokeWidth={fs * 0.06} />
          <text x={(x0 + x1) / 2} y={yW + fs * 1.15} fontFamily={FONT} fontSize={fs * 0.9} fill={col} textAnchor="middle">
            W {W} mm · D {D} mm
          </text>
          {L.loft
            ? (
              <>
                {seg(0, L.loftHeight, xH, `Loft ${L.loftHeight}`)}
                {seg(L.loftHeight, H, xH, `H ${L.bodyHeight} mm`)}
              </>
            )
            : seg(0, H, xH, `H ${H} mm`)}
        </g>
      );
    }

    const [h0, h1, h2] = finish.colors;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={className}
        role="img"
        aria-label={`${model.name} preview, ${W} by ${H} millimetres`}
        data-vbw={vb.w}
        data-vbh={vb.h}
      >
        <defs>
          {[...used].map((code) => {
            const t = getTexture(getLaminate(code));
            return (
              <pattern key={code} id={`${p}-lam-${code}`} patternUnits="userSpaceOnUse" width={t.tileW} height={t.tileH}>
                <image href={t.url} width={t.tileW} height={t.tileH} preserveAspectRatio="none" />
              </pattern>
            );
          })}
          <linearGradient id={`${p}-gloss`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".3" stopColor="#fff" stopOpacity=".32" />
            <stop offset=".42" stopColor="#fff" stopOpacity=".04" />
            <stop offset=".68" stopColor="#fff" stopOpacity=".14" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}-slat`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".3" />
            <stop offset=".35" stopColor="#fff" stopOpacity="0" />
            <stop offset=".8" stopColor="#000" stopOpacity=".2" />
            <stop offset="1" stopColor="#000" stopOpacity=".45" />
          </linearGradient>
          <linearGradient id={`${p}-flute`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".26" />
            <stop offset=".22" stopColor="#000" stopOpacity="0" />
            <stop offset=".55" stopColor="#fff" stopOpacity=".18" />
            <stop offset=".85" stopColor="#000" stopOpacity=".04" />
            <stop offset="1" stopColor="#000" stopOpacity=".3" />
          </linearGradient>
          <linearGradient id={`${p}-shadeDown`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".3" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}-shadeRight`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".25" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}-mirror`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eef2f3" />
            <stop offset=".45" stopColor="#bfc8cc" />
            <stop offset=".7" stopColor="#d7dde0" />
            <stop offset="1" stopColor="#a9b3b8" />
          </linearGradient>
          <linearGradient id={`${p}-hfH`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={h2} />
            <stop offset=".35" stopColor={h0} />
            <stop offset=".6" stopColor={h1} />
            <stop offset="1" stopColor={h2} />
          </linearGradient>
          <linearGradient id={`${p}-hfV`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={h2} />
            <stop offset=".35" stopColor={h0} />
            <stop offset=".6" stopColor={h1} />
            <stop offset="1" stopColor={h2} />
          </linearGradient>
          <linearGradient id={`${p}-alu`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9dcdf" />
            <stop offset=".5" stopColor="#9da2a7" />
            <stop offset="1" stopColor="#c8ccd0" />
          </linearGradient>
          <linearGradient id={`${p}-cornice`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".25" />
            <stop offset=".15" stopColor="#fff" stopOpacity=".25" />
            <stop offset=".3" stopColor="#000" stopOpacity=".15" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".15" />
            <stop offset=".75" stopColor="#000" stopOpacity=".2" />
            <stop offset="1" stopColor="#000" stopOpacity=".45" />
          </linearGradient>
          <linearGradient id={`${p}-ledGlow`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd98a" stopOpacity=".85" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}-light`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".1" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".12" />
          </linearGradient>
          <linearGradient id={`${p}-sideShade`} x1={sideRight ? "0" : "1"} y1="0" x2={sideRight ? "1" : "0"} y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".22" />
            <stop offset="1" stopColor="#000" stopOpacity=".42" />
          </linearGradient>
          <linearGradient id={`${p}-wall`} gradientUnits="userSpaceOnUse" x1="0" y1={vb.y} x2="0" y2={H}>
            <stop offset="0" stopColor="#f3eee7" />
            <stop offset="1" stopColor="#e3dbcf" />
          </linearGradient>
          <linearGradient id={`${p}-floor`} gradientUnits="userSpaceOnUse" x1="0" y1={H} x2="0" y2={vb.y + vb.h}>
            <stop offset="0" stopColor="#bba98f" />
            <stop offset="1" stopColor="#d6c8b3" />
          </linearGradient>
          <radialGradient id={`${p}-floorShadow`}>
            <stop offset="0" stopColor="#000" stopOpacity=".35" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <filter id={`${p}-hshadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="4" dy="6" stdDeviation="4" floodOpacity=".35" />
          </filter>
          <filter id={`${p}-slideShadow`} x="-10%" y="-5%" width="120%" height="110%">
            <feDropShadow dx="-10" dy="0" stdDeviation="10" floodOpacity=".3" />
          </filter>
          {interiorScene}
        </defs>

        {!bare && (
          <g>
            {/* Oversized so the room fills the stage beyond the viewBox (svg overflow is visible on screen). */}
            <rect x={vb.x - vb.w * 4} y={vb.y - vb.h * 4} width={vb.w * 9} height={H - vb.y + vb.h * 4} fill={`url(#${p}-wall)`} />
            <rect x={vb.x - vb.w * 4} y={H} width={vb.w * 9} height={vb.h * 5} fill={`url(#${p}-floor)`} />
            <rect x={vb.x - vb.w * 4} y={H - 70} width={vb.w * 9} height={70} fill="#f7f3ee" />
            <rect x={vb.x - vb.w * 4} y={H - 70} width={vb.w * 9} height={3} fill="rgba(0,0,0,.08)" />
            <ellipse cx={totalW / 2} cy={H + 8} rx={totalW * 0.6} ry={60} fill={`url(#${p}-floorShadow)`} />
          </g>
        )}
        {side}
        {front}
        {dims}
      </svg>
    );
  }),
);
