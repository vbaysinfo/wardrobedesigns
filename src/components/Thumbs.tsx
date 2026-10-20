// Small illustrative thumbnails for shutter styles and handles.
import type { ReactNode } from "react";
import type { HandleFinish } from "../state/types";

export function ShutterThumb({ style, color = "#c9a47c", accent = "#f1efea" }: { style: string; color?: string; accent?: string }) {
  const frame = "rgba(0,0,0,.28)";
  const light = "rgba(255,255,255,.45)";
  let detail: ReactNode = null;
  switch (style) {
    case "fluted":
      detail = Array.from({ length: 7 }, (_, i) => <line key={i} x1={9 + i * 4.6} y1={4} x2={9 + i * 4.6} y2={56} stroke={frame} strokeWidth={1.2} />);
      break;
    case "framed":
      detail = <rect x={11} y={10} width={18} height={40} fill="rgba(0,0,0,.05)" stroke={frame} strokeWidth={1.5} />;
      break;
    case "shaker":
      detail = (
        <>
          <rect x={13} y={12} width={14} height={36} fill="rgba(0,0,0,.12)" />
          <path d="M13 48V12h14" fill="none" stroke={frame} strokeWidth={2} />
          <path d="M13 48h14V12" fill="none" stroke={light} strokeWidth={1.5} />
        </>
      );
      break;
    case "arch":
      detail = <path d="M11 50V22a9 9 0 0 1 18 0v28Z" fill="rgba(0,0,0,.06)" stroke={frame} strokeWidth={1.5} />;
      break;
    case "glass":
      return (
        <svg viewBox="0 0 40 60" className="thumb-svg" aria-hidden="true">
          <rect x={6} y={3} width={28} height={54} rx={1} fill="#9da2a7" />
          <rect x={9} y={6} width={22} height={48} fill="#4b3b2e" />
          <line x1={9} y1={20} x2={31} y2={20} stroke="#8a7a6a" />
          <rect x={11} y={22} width={4} height={14} rx={1} fill="#8c7b6b" />
          <rect x={17} y={22} width={4} height={18} rx={1} fill="#6b5a4a" />
          <path d="M12 6 31 30V18L20 6Z" fill="rgba(255,255,255,.18)" />
        </svg>
      );
    case "mirror":
      detail = (
        <>
          <rect x={9} y={6} width={22} height={48} fill="#cfd6d9" />
          <path d="M13 6h7L9 24v-8Z" fill="rgba(255,255,255,.6)" />
        </>
      );
      break;
    case "two-tone":
      detail = <rect x={6} y={3} width={28} height={21} fill={accent} stroke={frame} strokeWidth={0.6} />;
      break;
  }
  return (
    <svg viewBox="0 0 40 60" className="thumb-svg" aria-hidden="true">
      <rect x={6} y={3} width={28} height={54} rx={1} fill={color} stroke={frame} strokeWidth={0.8} />
      {detail}
    </svg>
  );
}

export function HandleThumb({ style, finish }: { style: string; finish: HandleFinish }) {
  const [a, b, c] = finish.colors;
  const gid = `hg-${style}-${finish.id}`;
  return (
    <svg viewBox="0 0 40 60" className="thumb-svg" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor={c} />
          <stop offset=".4" stopColor={a} />
          <stop offset=".7" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <rect x={4} y={3} width={32} height={54} rx={1} fill="#efe9e0" stroke="rgba(0,0,0,.2)" strokeWidth={0.8} />
      {style === "bar-long" && <rect x={27} y={12} width={4} height={34} rx={2} fill={`url(#${gid})`} />}
      {style === "bar-mini" && <rect x={27} y={24} width={4} height={12} rx={2} fill={`url(#${gid})`} />}
      {style === "profile" && <rect x={31} y={3} width={5} height={54} fill={`url(#${gid})`} />}
      {style === "none" && <circle cx={29} cy={30} r={2.5} fill="none" stroke="rgba(0,0,0,.35)" strokeDasharray="1.5 1.5" />}
    </svg>
  );
}
