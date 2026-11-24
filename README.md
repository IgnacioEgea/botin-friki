# Botín Friki

Web de afiliación en español con el **calendario de lanzamientos de figuras Banpresto** como protagonista, más secciones de Pokémon, videojuegos y regalos.

- **Estática y segura:** generada con [Astro](https://astro.build), sin servidor, sin base de datos y sin inicio de sesión.
- **Sin datos personales:** sin cuentas, sin formularios de datos y sin cookies propias. El buscador ([Pagefind](https://pagefind.app)) funciona dentro del navegador.
- **Accesible:** objetivo WCAG 2.2 AA, modo claro por defecto y modo oscuro opcional, navegación completa con teclado.
- **Transparente:** los enlaces de afiliado están marcados y el aviso de Amazon aparece en todas las páginas.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/pages/es/` | Páginas en español (portada, secciones, legales, buscador) |
| `src/components/` | Calendario mensual y ficha de producto |
| `src/data/lanzamientos.json` | Lanzamientos del calendario (ahora mismo, datos de ejemplo) |
| `src/styles/global.css` | Colores, tipografía y componentes visuales |
| `public/_headers` | Cabeceras de seguridad (CSP, HSTS…) para Cloudflare Pages |

## Comandos

```bash
npm install
npm run dev      # servidor local
npm run build    # genera dist/ y el índice del buscador
```

## Despliegue

Cloudflare Pages · comando de build `npm run build` · carpeta de salida `dist` · Node 22.
