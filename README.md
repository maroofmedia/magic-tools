# Magic Tools

> Free, open-source file utilities that work entirely in your browser.

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Deploy to Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://netlify.com)

## Features

- 🖼️ **Image tools** — Compress, crop, convert formats (JPG, PNG, WebP, AVIF), batch compress, image→PDF
- 📄 **PDF tools** — Merge, split, compress, PDF→images
- 🔒 **100% private** — Files never leave your device. Zero uploads.
- ⚡ **Blazing fast** — Astro SSG, lazy-loaded libraries, Preact islands
- 🌙 **Dark mode** — System preference + manual toggle
- ♿ **Accessible** — WCAG 2.1 AA compliant, full keyboard navigation
- 📱 **Responsive** — Desktop, tablet, and mobile

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Astro 7](https://astro.build) | SSG framework |
| [Preact](https://preactjs.com) | Interactive islands (~3KB runtime) |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [pdf-lib](https://pdf-lib.js.org) | PDF merge/split/compress |
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) | PDF rendering |
| [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) | Image compression |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/yourusername/magic-tools.git
cd magic-tools
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Build

```bash
npm run build
```

Static output is written to `dist/`.

### Preview production build

```bash
npm run preview
```

## Deployment

### Cloudflare Pages

1. Push to GitHub.
2. In Cloudflare Pages, connect your repo.
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Deploy!

### Netlify

1. Push to GitHub.
2. In Netlify, import your repo.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

### GitHub Pages

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Project Structure

```
src/
├── components/
│   ├── common/         # Toast, ThemeToggle, Breadcrumb
│   ├── home/           # Hero, SearchBar, ToolCard, CategoryGrid, FAQ, PrivacySection
│   ├── layout/         # Header, Footer
│   └── tools/
│       ├── DropZone.tsx
│       ├── ProgressBar.tsx
│       ├── ToolProcessor.tsx
│       └── islands/    # One component per tool
├── layouts/
│   ├── BaseLayout.astro
│   └── ToolLayout.astro
├── lib/
│   ├── image/          # compress, convert, crop, batch
│   └── pdf/            # merge, split, compress, toImages
├── pages/
│   ├── index.astro
│   └── tools/[slug].astro
├── types/index.ts
└── utils/
    ├── helpers.ts
    ├── seo.ts
    └── tools-config.ts  ← add new tools here
```

## Adding a New Tool

1. Add an entry to `src/utils/tools-config.ts`
2. Create a processing function in `src/lib/`
3. Create a Preact island in `src/components/tools/islands/`
4. Import and mount the island in `src/pages/tools/[slug].astro`

A new page is automatically generated — no router config needed.

## Privacy Architecture

- **File API** — Files are read into memory, never written to disk
- **Canvas API** — Image processing via off-screen canvas
- **pdfjs-dist** — PDF rendering in-browser
- **pdf-lib** — PDF generation in-browser
- **No `fetch` calls with file data** — Network inspector confirms zero uploads

## License

MIT
