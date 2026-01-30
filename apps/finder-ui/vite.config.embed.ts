import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
    outDir: "dist-embed",
    rollupOptions: {
      input: {
        main: "embed.html"
      }
    }
  },
  server: {
    port: 5174,
    strictPort: true
  }
});
