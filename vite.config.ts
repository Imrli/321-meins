import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  // Relativ: gleicher Build fuer github.io/.../321-meins/ und Custom Domain (Apex).
  base: command === "serve" ? "/" : "./",
  // VITE_* + wie in der Projektanleitung: SUPABASE_URL, SUPABASE_ANON_KEY, MAILPIT_URL
  envPrefix: ["VITE_", "SUPABASE_", "MAILPIT_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
}));
