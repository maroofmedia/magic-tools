// ─────────────────────────────────────────────
// SEO utilities
// ─────────────────────────────────────────────

export const SITE_NAME = 'Magic Tools';
export const SITE_URL = 'https://magictools.app';
export const SITE_DESCRIPTION =
  'Free online file utilities that work entirely in your browser. Compress images, convert PDFs, crop photos, and more — no upload, no cloud, 100% private.';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.png`;

/** Build a full page title */
export function buildTitle(pageTitle?: string): string {
  if (!pageTitle) return `${SITE_NAME} — Free Browser-Based File Tools`;
  return `${pageTitle} — ${SITE_NAME}`;
}

/** Build a canonical URL */
export function buildCanonical(path: string): string {
  return `${SITE_URL}${path}`;
}

/** Build JSON-LD for a tool page */
export function buildToolSchema(opts: {
  name: string;
  description: string;
  url: string;
  breadcrumbs: { name: string; url: string }[];
}): string {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: opts.name,
        description: opts.description,
        url: opts.url,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        creator: {
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: opts.breadcrumbs.map((crumb, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
    ],
  };
  return JSON.stringify(schema);
}

/** Build JSON-LD for the homepage */
export function buildHomepageSchema(): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  return JSON.stringify(schema);
}
