// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: {
    host: process.env.HOST || "localhost",
    port: parseInt(process.env.PORT || "4322"),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
