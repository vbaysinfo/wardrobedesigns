// Minimal inline stroke icons (no icon-font or network dependency).
import type { SVGProps } from "react";

const paths: Record<string, string> = {
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  save: "M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v5h8V3M7 21v-7h10v7",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 19h16",
  upload: "M12 21V9m-5 5 5-5 5 5M4 5h16",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  json: "M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
  share: "M18 8a3 3 0 1 0-3-3l-6.5 4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0 9 4m3 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4M11 8v6M8 11h6",
  zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4M8 11h6",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  shrink: "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7",
  ruler: "M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2",
  compare: "M12 3v18M5 7l-3 5 3 5M19 7l3 5-3 5",
  rotate: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  close: "M6 6l12 12M18 6 6 18",
  copy: "M8 8h12v12H8zM4 16V4h12",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  check: "m5 12 5 5 9-10",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  wardrobe: "M4 3h16v18H4zM12 3v18M9.5 10v4M14.5 10v4",
  shutter: "M6 3h12v18H6zM9 6h6v12H9z",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.4-.8-2.2 0-.9.7-1.3 1.6-1.3H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8ZM7.5 11h.01M10 7h.01M15 7h.01",
  handle: "M10 4h4v16h-4zM8 7h2M8 17h2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3h.01",
  whatsapp: "M4 20l1.3-4A8 8 0 1 1 8.4 19L4 20Zm5-11c0 3.5 2.5 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}
