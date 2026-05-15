import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: 'static', // Cambiado para cumplir con Astro 6
  adapter: cloudflare(),
  integrations: [tailwind()],
});