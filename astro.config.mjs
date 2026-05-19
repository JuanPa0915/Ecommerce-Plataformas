import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Config principal de Astro para despliegue en Cloudflare Workers.
export default defineConfig({
  // Adaptador SSR para ejecutar la app como Worker.
  adapter: cloudflare(),
  vite: {
    // Tailwind v4 integrado como plugin Vite.
    plugins: [tailwindcss()],
  },
});