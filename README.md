# Wardrobe Studio – Laminate & Design Visualizer

A frontend-only, static web app for designing wardrobes. Pick a model, shutter
styles, laminates, handles and accessories, and the preview updates instantly. It needs no
backend, database, login or API keys, and runs entirely in the browser.

Built with **React + Vite + TypeScript**. Rendering uses the **layered 2D approach
(Option A)**: the wardrobe is drawn as SVG in real millimetre units, and each
laminate is a texture pattern applied to defined panel areas.

## Run & build

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve dist/ locally
```

## Deploying to Hostinger (or any static host)

1. Run `npm run build`.
2. Upload the **contents** of `dist/` (`index.html`, `assets/`, `textures/`, `favicon.svg`)
   with File Manager or FTP, for example to `public_html/wardrobe-studio/`.
3. Open `https://your-domain/wardrobe-studio/`.

All asset paths are relative (`base: "./"` in `vite.config.ts`), so the app works from any
folder. There is no server code and no runtime Node.js requirement.

## Features

- **22 wardrobe types in 5 categories**, which you can filter in the Model tab:
  - *Essentials*: two-, three- and four-door, flexible hinged, with loft, with drawers
  - *Modern*: sliding, floor-to-ceiling, handleless gloss, fluted statement, glass display, sliding mirror
  - *Traditional*: arch, colonial panelled, louvered colonial, heritage mirror
  - *Contemporary*: cane & mirror (wood frame on legs), rattan cane, boho two-tone
  - *Minimalist*: Scandinavian on legs, open shelves, minimal slab

  Curated types bring their own laminates, handles and per-shutter styles.
  Plain templates keep your current materials.
- **13 shutter styles**: plain, fluted, framed, shaker, arch, glass profile, reeded glass,
  mirror, arched mirror, cane panel, louvered, raised panel and two-colour. You can apply one per shutter.
- **Construction features**: tapered legs with metal caps, a solid-wood frame with a top cap, drawers
  under selected shutters, an open shelving column, cornice, plinth and LED lighting.
- **20 laminates** with search, category and finish filters. You can set separate materials
  for shutters, accent, side panels, loft and drawers, and per-shutter laminates.
- **Handles**: long bar, small minimalist, profile and handleless, in black, gold or silver.
  They are placed on each shutter's opening edge.
- **Accessories** (some are visible in the preview: LED light, cornice, plinth) and **colour combinations**.
- **Preview**: front and angled (left/right) views, a rotation slider, zoom, full screen,
  a dimensions overlay and a before/after comparison slider.
- **Editing**: undo/redo (Ctrl+Z / Ctrl+Y), reset, and click (or Shift-click) shutters to customise them individually.
- **Dimensions**: input validation, template range warnings and design advisories.
- **Save/load/duplicate/delete** in `localStorage`, with an autosave of the working design.
- **Export**: PNG download, JSON export/import, print-friendly summary (use “Save as PDF”
  in the print dialog), and WhatsApp click-to-chat sharing.
- **Quotation calculator** with editable sample rates, saved in `localStorage`.

## Customising the catalogue

All catalogue data is plain JSON in `src/data/`. Edit it and rebuild; no code changes are needed.

| File | Contents |
|---|---|
| `models.json` | Wardrobe types: category, door type, default size, limits, loft/drawers, decor (cornice, plinth, legs, frame), open shelf, and optional curated look (`defaultDoors`, `defaultMaterials`, `defaultHandle`, `defaultAccessories`) |
| `laminates.json` | Laminate name, code, category, finish, price/sq.ft, texture |
| `shutterStyles.json` | Shutter styles and their extra rate per sq.ft |
| `handles.json` | Handle styles (price) and finishes (colours, price factor) |
| `accessories.json` | Accessories, pricing unit (`each`, `perShutter`, `perMetre`) |
| `colorCombos.json` | Preset laminate/handle combinations |
| `pricing.json` | Default general rates (construction, loft, installation, GST…) |

### Adding a real laminate scan

Put the image in `public/textures/` (for example `my-oak.jpg`) and add an entry like this:

```json
{ "code": "AB-123", "name": "My Oak", "category": "Wood Grain", "finish": "Matte",
  "color": "#b58b5e", "pricePerSqft": 95,
  "texture": { "kind": "image", "src": "textures/my-oak.jpg", "tileMm": 600 } }
```

`tileMm` is the real-world size that one image tile represents. Built-in laminates use
seamless textures generated in the browser (`kind: "wood" | "solid" | "linen" | "concrete"`),
so the app works offline with no downloads.

## Architecture

```
src/
  data/        JSON catalogue + typed accessors (catalog.ts)
  state/       design model, sanitising, actions, undo history, localStorage
  engine/      layout.ts (geometry in mm) → WardrobeSVG.tsx (2D renderer),
               textures.ts, quote.ts, validate.ts, export.ts
  components/  left/right panels, preview, modals, print summary
```

`engine/layout.ts` turns a design into panel rectangles and is independent of the
renderer, so a Three.js renderer could consume the same layout later.

## Important notes

- **Local storage only.** Saved designs, prices and preferences live in this browser
  on this device. They are not synchronised between devices and are lost if site data is cleared.
  Use *Export JSON* for backups or to move designs. If stored data is corrupted, the app keeps
  working and keeps a backup copy.
- **Visual estimate.** The preview is proportional and to scale within template
  limits. It is not an engineering-accurate manufacturing drawing.
- **Indicative quotation.** Prices are editable sample rates applied to visual surface areas.
  They are not cutting-list quantities or factory costs. Verify everything before manufacturing.
