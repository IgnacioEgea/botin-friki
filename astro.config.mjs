import { defineConfig } from 'astro/config';

// Web estática: todas las páginas se generan al publicar.
export default defineConfig({
  site: 'https://botinfriki.pages.dev',
  trailingSlash: 'always',
  redirects: {
    '/': '/es/',
  },
  build: {
    // Hojas de estilo como archivos externos, para una CSP estricta.
    inlineStylesheets: 'never',
  },
});
