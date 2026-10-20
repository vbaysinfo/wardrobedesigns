import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes every asset URL relative, so the built `dist/` folder can be
// uploaded to any folder on static hosting (e.g. Hostinger public_html/wardrobe-studio/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", assetsInlineLimit: 0 },
});
