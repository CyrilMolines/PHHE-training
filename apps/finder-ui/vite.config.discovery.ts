import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  base: "./",
  build: {
    outDir: "dist-discovery",
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "discovery.html")
      }
    }
  }
});
