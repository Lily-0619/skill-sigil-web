import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import fs from "node:fs";

/**
 * 開発サーバー時に、プロジェクトの1つ上にある「画像/」フォルダを
 * /画像/... のURLで配信するミドルウェア。
 * 本番(単一HTML)では、HTMLをフォルダルートに置くことで
 * 相対パス「画像/...」がそのまま解決される。
 */
function serveGameImages(): Plugin {
  const imgRoot = path.resolve(__dirname, "..", "画像");
  const mime: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return {
    name: "serve-game-images",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const decoded = decodeURIComponent(req.url.split("?")[0]);
        if (!decoded.startsWith("/画像/")) return next();
        const rel = decoded.replace(/^\/画像\//, "");
        const file = path.join(imgRoot, rel);
        if (!file.startsWith(imgRoot) || !fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end("not found");
        }
        res.setHeader(
          "Content-Type",
          mime[path.extname(file).toLowerCase()] ?? "application/octet-stream"
        );
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), serveGameImages(), viteSingleFile()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
  },
});
