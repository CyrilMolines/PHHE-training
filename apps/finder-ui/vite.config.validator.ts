import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  base: "./",
  build: {
    outDir: "dist-validator",
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "validator.html")
      }
    }
  }
});
