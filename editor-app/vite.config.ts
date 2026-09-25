import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  // 画像を複製せず、Electronから既存サイトのpublicを直接参照する。
  publicDir: false,
  server: {
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, "desktop/index.html") },
  },
});
