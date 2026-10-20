import { useEffect, useRef, useState, type RefObject } from "react";
import { getModel } from "../data/catalog";
import { WardrobeSVG } from "../engine/WardrobeSVG";
import type { Design } from "../state/types";
import { Icon } from "./Icons";

interface Props {
  design: Design;
  before: Design;
  selected: number[];
  onDoorClick: (index: number, additive: boolean) => void;
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

      <div className="stage" ref={stageRef} onClick={(e) => e.target === e.currentTarget && p.onBackgroundClick()}>
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
            <WardrobeSVG ref={p.svgRef} design={p.design} angle={p.angle} showDims={p.showDims} selected={p.selected} onDoorClick={p.onDoorClick} className="main-svg" />
          )}
        </div>
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
            {model.name} · {p.selected.length ? `Shutter ${p.selected.map((i) => i + 1).join(", ")} selected` : "Click a shutter to customise it"} · Ctrl + scroll to zoom
          </span>
        )}
      </div>
    </section>
  );
}
