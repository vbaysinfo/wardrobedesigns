import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { getModel } from "../data/catalog";
import { WardrobeSVG } from "../engine/WardrobeSVG";
import type { Design } from "../state/types";
import { panelName } from "../state/design";
import { Icon } from "./Icons";
import { PanelEditBar } from "./PanelEditBar";

interface Props {
  design: Design;
  before: Design;
  selected: string[];
  panelKeys: string[];
  onPanelClick: (key: string, additive: boolean) => void;
  onSelect: (keys: string[]) => void;
  onApply: (d: Design, label: string) => void;
  onBackgroundClick: () => void;
  angle: number;
  onAngle: (a: number) => void;
  showDims: boolean;
  onToggleDims: () => void;
  onSetBefore: () => void;
  svgRef: RefObject<SVGSVGElement | null>;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function Preview(p: Props) {
  const [zoom, setZoom] = useState(1);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const model = getModel(p.design.modelId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barPos, setBarPos] = useState<{ left: number; top: number } | "docked" | null>(null);

  // Anchor the edit bar beside the selected panels (falls back to docking at the bottom).
  const placeBar = useCallback(() => {
    const wrap = wrapRef.current, svg = p.svgRef.current, bar = barRef.current;
    if (!wrap || !svg || !p.selected.length) return setBarPos(null);
    const wr = wrap.getBoundingClientRect();
    if (wr.width < 560) return setBarPos("docked");
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    p.selected.forEach((k) => {
      const el = svg.querySelector(`[data-panel="${k}"] .ws-door-hit`);
      if (!el) return;
      const bb = el.getBoundingClientRect();
      l = Math.min(l, bb.left); t = Math.min(t, bb.top); r = Math.max(r, bb.right); b = Math.max(b, bb.bottom);
    });
    if (!Number.isFinite(l)) return setBarPos("docked");
    const bw = bar?.offsetWidth ?? 340, bh = bar?.offsetHeight ?? 220, gap = 14;
    const clampTop = (y: number) => Math.max(8, Math.min(wr.height - bh - 8, y));
    const midY = clampTop((t + b) / 2 - wr.top - bh / 2);
    if (r - wr.left + gap + bw <= wr.width - 8) return setBarPos({ left: r - wr.left + gap, top: midY });
    if (l - wr.left - gap - bw >= 8) return setBarPos({ left: l - wr.left - gap - bw, top: midY });
    setBarPos("docked");
  }, [p.selected, p.svgRef]);

  useLayoutEffect(() => {
    placeBar();
  }, [placeBar, p.design, zoom, p.angle, p.showDims, compare, fullscreen]);

  useEffect(() => {
    const stage = stageRef.current, wrap = wrapRef.current;
    if (!stage || !wrap) return;
    const ro = new ResizeObserver(placeBar);
    ro.observe(wrap);
    stage.addEventListener("scroll", placeBar, { passive: true });
    return () => {
      ro.disconnect();
      stage.removeEventListener("scroll", placeBar);
    };
  }, [placeBar]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(0.5, +(z * (e.deltaY < 0 ? 1.1 : 0.9)).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const stepZoom = (dir: 1 | -1) =>
    setZoom((z) => {
      if (dir > 0) return ZOOMS.find((v) => v > z + 0.001) ?? 3;
      return [...ZOOMS].reverse().find((v) => v < z - 0.001) ?? 0.5;
    });

  const toggleFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else if (el.requestFullscreen) {
      await el.requestFullscreen().catch(() => setFullscreen((f) => !f));
    } else {
      setFullscreen((f) => !f); // CSS fallback (e.g. iOS Safari)
    }
  };

  const dragSplit = (e: React.PointerEvent) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.min(100, Math.max(0, ((ev.clientX - box.left) / box.width) * 100)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  const views = [
    { label: "Front", value: 0 },
    { label: "Angle L", value: -24 },
    { label: "Angle R", value: 24 },
  ];

  return (
    <section ref={rootRef} className={fullscreen ? "preview is-fullscreen" : "preview"} aria-label="Live preview">
      <div className="toolbar">
        <div className="segmented" role="radiogroup" aria-label="View">
          {views.map((v) => (
            <button key={v.label} role="radio" aria-checked={p.angle === v.value} className={p.angle === v.value ? "active" : ""} onClick={() => p.onAngle(v.value)}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="rotate" title="Rotate">
          <Icon name="rotate" size={16} />
          <input type="range" min={-35} max={35} step={1} value={p.angle} onChange={(e) => p.onAngle(Number(e.target.value))} aria-label="Rotation angle" />
        </label>
        <div className="tool-group">
          <button className="icon-btn" onClick={() => stepZoom(-1)} disabled={zoom <= 0.5} title="Zoom out" aria-label="Zoom out">
            <Icon name="zoomOut" />
          </button>
          <button className="zoom-label" onClick={() => setZoom(1)} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button className="icon-btn" onClick={() => stepZoom(1)} disabled={zoom >= 3} title="Zoom in" aria-label="Zoom in">
            <Icon name="zoomIn" />
          </button>
        </div>
        <div className="tool-group">
          <button className={p.showDims ? "icon-btn on" : "icon-btn"} onClick={p.onToggleDims} title="Show dimensions" aria-pressed={p.showDims} aria-label="Show dimensions">
            <Icon name="ruler" />
          </button>
          <button className={compare ? "icon-btn on" : "icon-btn"} onClick={() => setCompare((c) => !c)} title="Before / after comparison" aria-pressed={compare} aria-label="Before and after comparison">
            <Icon name="compare" />
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title={fullscreen ? "Exit full screen" : "Full screen"} aria-label="Full screen">
            <Icon name={fullscreen ? "shrink" : "expand"} />
          </button>
        </div>
      </div>

      <div className="stage-wrap" ref={wrapRef}>
      <div className="stage" ref={stageRef} onClick={(e) => (e.target === e.currentTarget || (e.target as Element).closest?.(".stage-inner") === e.target) && p.onBackgroundClick()}>
        <div className="stage-inner" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          {compare ? (
            <div className="compare">
              <WardrobeSVG design={p.before} angle={p.angle} showDims={p.showDims} className="layer" />
              <div className="layer after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                <WardrobeSVG ref={p.svgRef} design={p.design} angle={p.angle} showDims={p.showDims} />
              </div>
              <div className="split" style={{ left: `${split}%` }} onPointerDown={dragSplit} role="separator" aria-label="Comparison slider">
                <span>
                  <Icon name="compare" size={16} />
                </span>
              </div>
              <span className="tag tag-left">Before</span>
              <span className="tag tag-right">After</span>
            </div>
          ) : (
            <WardrobeSVG
              ref={p.svgRef}
              design={p.design}
              angle={p.angle}
              showDims={p.showDims}
              selected={p.selected}
              onPanelClick={p.onPanelClick}
              className="main-svg"
            />
          )}
        </div>
      </div>
      {!compare && p.selected.length > 0 && (
        <div ref={barRef} className={barPos === "docked" ? "edit-bar-host docked" : "edit-bar-host"} style={barPos && barPos !== "docked" ? { left: barPos.left, top: barPos.top } : { visibility: barPos ? undefined : "hidden" }}>
          <PanelEditBar design={p.design} selected={p.selected} panelKeys={p.panelKeys} onApply={p.onApply} onSelect={p.onSelect} />
        </div>
      )}
      </div>

      <div className="stage-foot">
        {compare ? (
          <>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Comparison position" />
            <button className="btn btn-ghost btn-sm" onClick={p.onSetBefore}>
              Set current as “before”
            </button>
          </>
        ) : (
          <span>
            {model.name} · {p.selected.length ? `${p.selected.map(panelName).join(", ")} selected` : "Click any shutter, loft shutter or drawer to edit it"} · Ctrl + scroll to zoom
          </span>
        )}
      </div>
    </section>
  );
}
