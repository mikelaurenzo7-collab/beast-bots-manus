import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev only — in production, the web bundle is served by a reverse
      // proxy in front of the API (same origin) so this alias disappears.
      "/v1": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
