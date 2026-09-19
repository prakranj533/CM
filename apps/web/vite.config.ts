import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vuetify from "vite-plugin-vuetify";

const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:4000";

export default defineConfig({
  // `autoImport` tree-shakes Vuetify: only components actually used ship in the bundle.
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Proxying keeps the browser on one origin in development, so session cookies
    // are first-party and no CORS preflight is involved.
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
