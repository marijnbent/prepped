// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  fonts: [{ provider: fontProviders.google(), name: "Outfit", cssVariable: "--font-outfit", weights: ["100 900"], styles: ["normal"], subsets: ["latin"] }],
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: {
    host: process.env.HOST || "127.0.0.1",
    port: parseInt(process.env.PORT || "4322"),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
