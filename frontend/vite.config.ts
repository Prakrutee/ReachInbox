import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? "/ReachInbox/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:10000", changeOrigin: true },
      "/auth": { target: "http://localhost:10000", changeOrigin: true },
      "/admin": { target: "http://localhost:10000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
