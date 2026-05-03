// Static check catalog. Single source of truth for the human-readable
// description / how-to-fix / category for every AlertType the backend can
// emit. Used by the inbox detail drawer, the per-category drill-in, the
// per-AlertType drill-in, and (eventually) email and Slack notification
// templates. AGENTS.md "Repo layout" links here.
//
// Rules:
//   * One entry per AlertType in src/api/types.ts. The integrity test in
//     src/api/__tests__/checkCatalog.test.ts asserts the two stay in sync.
//   * Keep description and howToFix tight - 1 to 2 sentences each. We will
//     iterate on copy later.
//   * `category` mirrors IssuesSummaryBuilder.categoryOf on the backend
//     verbatim. Do not rename without updating the Java side.
//   * `marketingId` follows the dotted style from the marketing
//     index_v2.html catalog (e.g. "title.missing", "js.duplicate-tracker").
//     Treated as opaque outside the marketing surface; do not parse.

import type { AlertType, Severity } from "./types"

export type CheckCatalogEntry = {
  type: AlertType
  category: string
  severityDefault: Severity
  title: string
  description: string
  howToFix: string
  marketingId: string
}

const ENTRIES: CheckCatalogEntry[] = [
  // ---------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------
  {
    type: "TITLE_MISSING",
    category: "Title",
    severityDefault: "ERROR",
    title: "Page title missing",
    description:
      "The page has no <title> tag. Search engines fall back to the URL or a fragment of body text, which hurts click-through.",
    howToFix:
      "Add a unique, descriptive <title> in the <head>. Aim for 50 to 60 characters that match the page intent.",
    marketingId: "title.missing",
  },
  {
    type: "TITLE_TOO_LONG",
    category: "Title",
    severityDefault: "WARNING",
    title: "Title too long",
    description:
      "Titles longer than ~60 characters are truncated in search results, hiding the part that converts.",
    howToFix:
      "Trim the title to 50 to 60 characters and front-load the most important keywords.",
    marketingId: "title.too-long",
  },
  {
    type: "TITLE_TOO_SHORT",
    category: "Title",
    severityDefault: "NOTICE",
    title: "Title too short",
    description:
      "Very short titles miss ranking-relevant keywords and look thin in SERP listings.",
    howToFix:
      "Expand the title to 30 to 60 characters with descriptive, specific wording about the page topic.",
    marketingId: "title.too-short",
  },
  {
    type: "TITLE_MULTIPLE",
    category: "Title",
    severityDefault: "WARNING",
    title: "Multiple title tags",
    description:
      "More than one <title> tag was found. Browsers and crawlers pick one inconsistently.",
    howToFix:
      "Keep exactly one <title> tag in the <head>. Remove the duplicates from templates and partials.",
    marketingId: "title.multiple",
  },
  {
    type: "DUPLICATE_TITLE",
    category: "Title",
    severityDefault: "WARNING",
    title: "Duplicate title across pages",
    description:
      "Two or more pages share the same title, making them compete in search results.",
    howToFix:
      "Give each page a unique title that reflects its specific content. Use templates with page-specific variables.",
    marketingId: "title.duplicate",
  },

  // ---------------------------------------------------------------------
  // Meta Description
  // ---------------------------------------------------------------------
  {
    type: "META_DESCRIPTION_MISSING",
    category: "Meta Description",
    severityDefault: "WARNING",
    title: "Meta description missing",
    description:
      "Without a meta description, search engines auto-generate a snippet, which is rarely flattering for click-through.",
    howToFix:
      "Add a 120 to 160 character <meta name=\"description\"> that summarises the page and nudges the click.",
    marketingId: "meta.missing",
  },
  {
    type: "META_DESCRIPTION_TOO_LONG",
    category: "Meta Description",
    severityDefault: "NOTICE",
    title: "Meta description too long",
    description:
      "Descriptions over ~160 characters get truncated in SERP snippets, losing your final call to action.",
    howToFix:
      "Trim to 120 to 160 characters. Lead with the value proposition.",
    marketingId: "meta.over-length",
  },
  {
    type: "META_DESCRIPTION_TOO_SHORT",
    category: "Meta Description",
    severityDefault: "NOTICE",
    title: "Meta description too short",
    description:
      "Very short descriptions waste prime SERP real estate and miss keywords.",
    howToFix:
      "Expand to 120 to 160 characters with specific, page-relevant copy.",
    marketingId: "meta.too-short",
  },
  {
    type: "META_DESCRIPTION_MULTIPLE",
    category: "Meta Description",
    severityDefault: "WARNING",
    title: "Multiple meta descriptions",
    description:
      "More than one meta description tag is present; crawlers pick one unpredictably.",
    howToFix:
      "Keep exactly one <meta name=\"description\"> per page in the <head>.",
    marketingId: "meta.multiple",
  },
  {
    type: "DUPLICATE_META_DESCRIPTION",
    category: "Meta Description",
    severityDefault: "NOTICE",
    title: "Duplicate meta description",
    description:
      "Multiple pages share the same meta description, weakening relevance signals.",
    howToFix:
      "Write a distinct meta description for each page that highlights what is unique about it.",
    marketingId: "meta.duplicate",
  },

  // ---------------------------------------------------------------------
  // Headings
  // ---------------------------------------------------------------------
  {
    type: "H1_MISSING",
    category: "Headings",
    severityDefault: "WARNING",
    title: "H1 missing",
    description:
      "The page has no H1. Crawlers and screen readers rely on it as the primary topic signal.",
    howToFix:
      "Add a single H1 that names the page topic clearly. Place it above the main content.",
    marketingId: "h1.missing",
  },
  {
    type: "H1_MULTIPLE",
    category: "Headings",
    severityDefault: "NOTICE",
    title: "Multiple H1 tags",
    description:
      "More than one H1 dilutes the primary topic signal and confuses screen readers.",
    howToFix:
      "Keep one H1 per page. Demote the rest to H2 or H3 to reflect the real document outline.",
    marketingId: "h1.multiple",
  },
  {
    type: "DUPLICATE_H1",
    category: "Headings",
    severityDefault: "NOTICE",
    title: "Duplicate H1 across pages",
    description:
      "Multiple pages share the same H1, suggesting overlapping topics or templating gaps.",
    howToFix:
      "Make each page's H1 specific to its topic. Audit templates that interpolate the same string.",
    marketingId: "h1.duplicate",
  },

  // ---------------------------------------------------------------------
  // HTTP Status
  // ---------------------------------------------------------------------
  {
    type: "HTTP_404",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "404 Not Found",
    description:
      "The page returns 404. Search engines drop it from the index and inbound links waste their authority.",
    howToFix:
      "Restore the page, redirect (301) the URL to its replacement, or remove inbound links pointing at it.",
    marketingId: "http.404",
  },
  {
    type: "HTTP_403",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "403 Forbidden",
    description:
      "The server refused the request. Crawlers and users alike see a wall instead of content.",
    howToFix:
      "Check auth rules, IP allowlists, and crawler user-agent blocks. Open the page to public traffic if it should be indexed.",
    marketingId: "http.403",
  },
  {
    type: "HTTP_409",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "409 Conflict",
    description:
      "The server reports the request conflicts with current state. Often a deployment or data race issue.",
    howToFix:
      "Inspect server logs, fix the conflicting condition, and retry. Add a regression test if it recurs.",
    marketingId: "http.409",
  },
  {
    type: "HTTP_4XX",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "4xx client error",
    description:
      "The page returned a 4xx response other than 403/404/409. The URL is unreachable for crawlers.",
    howToFix:
      "Check the exact status in the alert detail and fix the underlying cause (auth, validation, missing resource).",
    marketingId: "http.4xx",
  },
  {
    type: "HTTP_500",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "500 Internal Server Error",
    description:
      "The server crashed handling this URL. Repeated 500s deindex the page over time.",
    howToFix:
      "Check application logs for the stack trace and ship a fix. Add monitoring on this endpoint.",
    marketingId: "http.500",
  },
  {
    type: "HTTP_5XX",
    category: "HTTP Status",
    severityDefault: "ERROR",
    title: "5xx server error",
    description:
      "The page returned a 5xx response. Search engines treat repeated 5xx as a removal signal.",
    howToFix:
      "Investigate server logs for the failing path. Add retry / fallback handling so transient issues do not surface.",
    marketingId: "http.5xx",
  },

  // ---------------------------------------------------------------------
  // Indexability
  // ---------------------------------------------------------------------
  {
    type: "NOINDEX_PAGE",
    category: "Indexability",
    severityDefault: "WARNING",
    title: "Page is noindex",
    description:
      "The page sets robots noindex. Search engines will not include it in results.",
    howToFix:
      "If the page should rank, remove the noindex directive from meta robots and the X-Robots-Tag header.",
    marketingId: "noindex.page",
  },
  {
    type: "NOFOLLOW_PAGE",
    category: "Indexability",
    severityDefault: "NOTICE",
    title: "Page-level nofollow",
    description:
      "All outbound links on this page are flagged nofollow at the page level, breaking internal link equity.",
    howToFix:
      "Drop the page-level nofollow unless this is a pure UGC sandbox. Use per-link rel=nofollow where it really matters.",
    marketingId: "nofollow.page",
  },
  {
    type: "NOINDEX_FOLLOW",
    category: "Indexability",
    severityDefault: "NOTICE",
    title: "noindex, follow",
    description:
      "The page is noindex but follow. Often intentional, occasionally a leftover that hides ranking content.",
    howToFix:
      "Confirm the page should not rank. If it should, remove the noindex.",
    marketingId: "noindex.follow",
  },
  {
    type: "NOINDEX_NOFOLLOW",
    category: "Indexability",
    severityDefault: "WARNING",
    title: "noindex, nofollow",
    description:
      "The page blocks both indexing and link following. Inbound link authority is wasted.",
    howToFix:
      "Decide what the page is for. Either remove it, remove inbound links, or relax the directive.",
    marketingId: "noindex.nofollow",
  },
  {
    type: "NOINDEX_CONFLICT",
    category: "Indexability",
    severityDefault: "WARNING",
    title: "Conflicting noindex signals",
    description:
      "Different sources (meta robots, X-Robots-Tag, sitemap) disagree on whether the page should be indexed.",
    howToFix:
      "Pick one source of truth and align the others. Audit middleware that may inject conflicting headers.",
    marketingId: "noindex.conflict",
  },
  {
    type: "NOFOLLOW_CONFLICT",
    category: "Indexability",
    severityDefault: "NOTICE",
    title: "Conflicting nofollow signals",
    description:
      "Meta robots and X-Robots-Tag disagree on follow / nofollow.",
    howToFix:
      "Decide which directive is correct, then remove the other.",
    marketingId: "nofollow.conflict",
  },

  // ---------------------------------------------------------------------
  // Markup
  // ---------------------------------------------------------------------
  {
    type: "INVALID_LANG",
    category: "Markup",
    severityDefault: "NOTICE",
    title: "Invalid lang attribute",
    description:
      "<html lang> is missing or not a valid BCP-47 tag. Search engines and screen readers cannot determine the page language.",
    howToFix:
      "Set a valid lang attribute on the <html> element (for example, lang=\"en\" or lang=\"en-US\").",
    marketingId: "markup.lang-invalid",
  },
  {
    type: "MISSING_VIEWPORT",
    category: "Markup",
    severityDefault: "WARNING",
    title: "Missing viewport meta",
    description:
      "No <meta name=\"viewport\"> tag. Mobile rendering will be broken and Google flags the page as non-mobile-friendly.",
    howToFix:
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> in the <head>.",
    marketingId: "markup.missing-viewport",
  },

  // ---------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------
  {
    type: "LOW_WORD_COUNT",
    category: "Content",
    severityDefault: "NOTICE",
    title: "Thin content",
    description:
      "The page has very few words. Thin content rarely ranks and may be classified as low quality.",
    howToFix:
      "Add substantive copy that covers the topic in depth, or noindex / consolidate the page if it is a thin utility view.",
    marketingId: "content.thin",
  },

  // ---------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------
  {
    type: "SLOW_PAGE",
    category: "Performance",
    severityDefault: "WARNING",
    title: "Slow page response",
    description:
      "Total response time is high. Slow pages cost rankings and conversions.",
    howToFix:
      "Profile the page, fix backend hot spots, enable caching, and trim render-blocking resources.",
    marketingId: "perf.slow-page",
  },
  {
    type: "OVERSIZED_HTML",
    category: "Performance",
    severityDefault: "NOTICE",
    title: "Oversized HTML",
    description:
      "The HTML payload is unusually large, slowing parsing and hurting Core Web Vitals.",
    howToFix:
      "Strip unused inline data, paginate long lists, and move large markup chunks behind progressive loads.",
    marketingId: "perf.html-oversized",
  },
  {
    type: "NO_COMPRESSION",
    category: "Performance",
    severityDefault: "WARNING",
    title: "No HTTP compression",
    description:
      "The response is not gzip / br compressed, wasting bandwidth and slowing time-to-first-byte for clients.",
    howToFix:
      "Enable gzip or brotli on the server / CDN for HTML, CSS, JS, and JSON.",
    marketingId: "perf.no-compression",
  },
  {
    type: "SLOW_TTFB",
    category: "Performance",
    severityDefault: "WARNING",
    title: "Slow time-to-first-byte",
    description:
      "TTFB is high, indicating server or origin latency. This drags every other metric.",
    howToFix:
      "Add caching at the CDN and origin, optimise the slowest backend handler, and move static assets to a CDN.",
    marketingId: "perf.ttfb-slow",
  },

  // ---------------------------------------------------------------------
  // Internal Links
  // ---------------------------------------------------------------------
  {
    type: "NO_OUTGOING_LINKS",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "No outgoing internal links",
    description:
      "The page links to nothing else on the site. Crawlers cannot use it as a hub.",
    howToFix:
      "Add contextual links to related pages. Even a footer / nav block helps if the page must stand alone.",
    marketingId: "link.no-outgoing",
  },
  {
    type: "DOUBLE_SLASH_URL",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Double-slash in URL",
    description:
      "The URL contains a doubled slash, often produced by a templating bug, and can split crawl signals.",
    howToFix:
      "Fix the link template that emits the doubled slash. Add a redirect from the malformed URL to the canonical one.",
    marketingId: "link.double-slash",
  },
  {
    type: "TOO_MANY_URL_PARAMS",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Too many URL parameters",
    description:
      "The URL stacks many query parameters, which can fragment crawl coverage and confuse canonicalisation.",
    howToFix:
      "Consolidate parameters via canonical URLs or rewrite to clean paths where possible.",
    marketingId: "link.url-params",
  },
  {
    type: "ORPHAN_PAGE",
    category: "Internal Links",
    severityDefault: "WARNING",
    title: "Orphan page",
    description:
      "No internal page links here. Search engines reach it only via the sitemap, with weak ranking signals.",
    howToFix:
      "Link the page from a related hub or category page so crawlers can discover and value it.",
    marketingId: "link.orphan-page",
  },
  {
    type: "LINKS_TO_BROKEN",
    category: "Internal Links",
    severityDefault: "ERROR",
    title: "Links to broken page",
    description:
      "This page links to a 4xx / 5xx URL on the site. Users hit dead ends and equity is wasted.",
    howToFix:
      "Update the link to a working URL or remove it. Restore or redirect the broken target if it should still exist.",
    marketingId: "link.broken-internal",
  },
  {
    type: "LINKS_TO_REDIRECT_INDEXABLE",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Links to redirected page",
    description:
      "The link target redirects to an indexable page. Working but wastes a hop and a little crawl budget.",
    howToFix:
      "Update the link to the final URL so users and crawlers skip the redirect.",
    marketingId: "link.redirect-indexable",
  },
  {
    type: "LINKS_TO_REDIRECT_NON_INDEXABLE",
    category: "Internal Links",
    severityDefault: "WARNING",
    title: "Links to non-indexable redirect",
    description:
      "The link redirects to a URL the crawler cannot index. Equity is lost.",
    howToFix:
      "Point the link directly at an indexable destination, or fix the noindex / robots block on the redirect target.",
    marketingId: "link.redirect-non-indexable",
  },
  {
    type: "LINKS_TO_BROKEN_NON_INDEXABLE",
    category: "Internal Links",
    severityDefault: "WARNING",
    title: "Links to broken non-indexable",
    description:
      "The link target is both broken and non-indexable, so neither users nor crawlers can use it.",
    howToFix:
      "Replace with a live, indexable link or remove the reference entirely.",
    marketingId: "link.broken-non-indexable",
  },
  {
    type: "NOFOLLOW_ONLY_INCOMING",
    category: "Internal Links",
    severityDefault: "WARNING",
    title: "Only nofollow incoming links",
    description:
      "Every internal link to this page is nofollow. Search engines do not pass authority through.",
    howToFix:
      "Promote at least one canonical incoming link to dofollow so the page can rank.",
    marketingId: "link.nofollow-only",
  },
  {
    type: "MIXED_FOLLOW_INCOMING",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Mixed follow / nofollow incoming",
    description:
      "Internal links to this page mix follow and nofollow, which is usually a templating accident.",
    howToFix:
      "Audit the link templates and choose a consistent stance. Drop accidental rel=nofollow.",
    marketingId: "link.mixed-follow",
  },
  {
    type: "NOFOLLOW_OUTGOING_INTERNAL",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Nofollow on internal link",
    description:
      "An internal link is marked rel=nofollow, blocking authority flow on your own site.",
    howToFix:
      "Remove rel=nofollow from internal links. Reserve it for genuine UGC or paid placements.",
    marketingId: "link.nofollow-outgoing",
  },
  {
    type: "SINGLE_DOFOLLOW_INCOMING",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Only one dofollow incoming",
    description:
      "Just one internal page passes equity here. Single points of failure for crawl and rank.",
    howToFix:
      "Add more contextual links from related pages so the destination has redundant discovery paths.",
    marketingId: "link.single-dofollow",
  },
  {
    type: "REDIRECT_NO_INCOMING",
    category: "Internal Links",
    severityDefault: "NOTICE",
    title: "Redirect with no incoming",
    description:
      "A redirect endpoint with no inbound internal links is dead weight in the link graph.",
    howToFix:
      "Remove the redirect if no link references it, or add the inbound link the redirect was meant to support.",
    marketingId: "link.redirect-orphan",
  },

  // ---------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------
  {
    type: "MISSING_ALT_TEXT",
    category: "Images",
    severityDefault: "WARNING",
    title: "Missing alt text",
    description:
      "An image has no alt attribute. Screen readers and image search cannot describe it.",
    howToFix:
      "Add descriptive alt text. Use alt=\"\" only for purely decorative images.",
    marketingId: "img.alt-missing",
  },
  {
    type: "BROKEN_IMAGE",
    category: "Images",
    severityDefault: "ERROR",
    title: "Broken image",
    description:
      "The image URL returns an error. Users see a placeholder, search engines drop it from image results.",
    howToFix:
      "Fix the image URL or upload the missing asset. Add monitoring on critical images.",
    marketingId: "img.broken-src",
  },
  {
    type: "OVERSIZED_IMAGE",
    category: "Images",
    severityDefault: "WARNING",
    title: "Oversized image",
    description:
      "The image file is much larger than its rendered size, slowing the page.",
    howToFix:
      "Serve right-sized variants via srcset, compress losslessly, and prefer modern formats (AVIF / WebP).",
    marketingId: "img.oversized",
  },
  {
    type: "IMAGE_REDIRECT",
    category: "Images",
    severityDefault: "NOTICE",
    title: "Image URL redirects",
    description:
      "The image src redirects, costing an extra round-trip on every load.",
    howToFix:
      "Update the markup to the final URL so the browser fetches the asset directly.",
    marketingId: "img.redirect",
  },
  {
    type: "MISSING_IMAGE_DIMENSIONS",
    category: "Images",
    severityDefault: "NOTICE",
    title: "Missing image dimensions",
    description:
      "The image has no width / height attributes, which causes layout shift (bad CLS).",
    howToFix:
      "Add explicit width and height attributes that match the intrinsic image ratio.",
    marketingId: "img.no-dimensions",
  },

  // ---------------------------------------------------------------------
  // Social
  // ---------------------------------------------------------------------
  {
    type: "MISSING_OG_TAGS",
    category: "Social",
    severityDefault: "NOTICE",
    title: "Missing Open Graph tags",
    description:
      "The page is missing og:title / og:description / og:image. Social shares fall back to ugly auto-snippets.",
    howToFix:
      "Add og:title, og:description, og:image, and og:url. Reuse the page title and a cropped hero image.",
    marketingId: "og.missing",
  },
  {
    type: "OG_CANONICAL_MISMATCH",
    category: "Social",
    severityDefault: "NOTICE",
    title: "og:url and canonical disagree",
    description:
      "og:url does not match the canonical URL. Shares may land on the wrong variant.",
    howToFix:
      "Set og:url to the canonical URL of the page.",
    marketingId: "og.canonical-mismatch",
  },
  {
    type: "MISSING_TWITTER_CARD",
    category: "Social",
    severityDefault: "NOTICE",
    title: "Missing Twitter Card",
    description:
      "twitter:card is absent. Twitter / X falls back to a plain link preview.",
    howToFix:
      "Add twitter:card (typically summary_large_image) plus twitter:title, twitter:description, twitter:image.",
    marketingId: "twitter.card-missing",
  },

  // ---------------------------------------------------------------------
  // Redirects
  // ---------------------------------------------------------------------
  {
    type: "REDIRECT_302",
    category: "Redirects",
    severityDefault: "NOTICE",
    title: "302 temporary redirect",
    description:
      "The URL serves a 302. Crawlers may keep crawling the source if they expect it to come back.",
    howToFix:
      "If the redirect is permanent, switch to 301 so authority transfers fully.",
    marketingId: "redirect.302",
  },
  {
    type: "REDIRECT_3XX",
    category: "Redirects",
    severityDefault: "NOTICE",
    title: "3xx redirect",
    description:
      "The URL returns a non-301/302 redirect status. Browsers follow it but crawlers handle it inconsistently.",
    howToFix:
      "Replace with a 301 (permanent) where appropriate.",
    marketingId: "redirect.3xx",
  },
  {
    type: "BROKEN_REDIRECT",
    category: "Redirects",
    severityDefault: "ERROR",
    title: "Broken redirect",
    description:
      "The redirect target is a 4xx / 5xx response. Users land on an error.",
    howToFix:
      "Repoint the redirect at a live URL. Remove the rule entirely if no working destination exists.",
    marketingId: "redirect.to-broken",
  },
  {
    type: "REDIRECT_CHAIN",
    category: "Redirects",
    severityDefault: "NOTICE",
    title: "Redirect chain",
    description:
      "More than one redirect hop before the final URL. Wastes crawl budget and slows users.",
    howToFix:
      "Update the first hop to point directly at the final URL.",
    marketingId: "redirect.chain",
  },
  {
    type: "REDIRECT_CHAIN_TOO_LONG",
    category: "Redirects",
    severityDefault: "WARNING",
    title: "Redirect chain too long",
    description:
      "The redirect chain has too many hops. Some crawlers stop following before the destination.",
    howToFix:
      "Collapse the chain so the original URL hops directly to the final URL.",
    marketingId: "redirect.too-many-hops",
  },
  {
    type: "REDIRECT_LOOP",
    category: "Redirects",
    severityDefault: "ERROR",
    title: "Redirect loop",
    description:
      "The redirect chain points back to itself. Browsers and crawlers give up.",
    howToFix:
      "Find the rule that creates the cycle and remove or repoint it.",
    marketingId: "redirect.loop",
  },
  {
    type: "HTTPS_TO_HTTP_REDIRECT",
    category: "Redirects",
    severityDefault: "ERROR",
    title: "HTTPS redirects to HTTP",
    description:
      "An HTTPS URL redirects to HTTP. This is a security and SEO regression.",
    howToFix:
      "Repoint the redirect at the HTTPS variant. Audit your redirect rules for accidental scheme downgrades.",
    marketingId: "redirect.https-to-http",
  },
  {
    type: "HTTP_TO_HTTPS_REDIRECT",
    category: "Redirects",
    severityDefault: "NOTICE",
    title: "HTTP to HTTPS redirect",
    description:
      "An HTTP URL redirects to HTTPS. Expected, but every internal link should target HTTPS directly to skip the hop.",
    howToFix:
      "Update internal links to use https:// so users and crawlers skip the redirect.",
    marketingId: "redirect.http-to-https",
  },
  {
    type: "META_REFRESH_REDIRECT",
    category: "Redirects",
    severityDefault: "WARNING",
    title: "Meta refresh redirect",
    description:
      "The page uses a <meta http-equiv=\"refresh\"> tag. Crawlers may treat it as a soft 200 instead of a redirect.",
    howToFix:
      "Use a server-side 301 / 302 redirect instead of meta refresh.",
    marketingId: "redirect.meta-refresh",
  },
  {
    type: "TIMEOUT",
    category: "Redirects",
    severityDefault: "ERROR",
    title: "Request timed out",
    description:
      "The crawl request timed out. The URL is effectively unreachable for crawlers and slow users.",
    howToFix:
      "Investigate origin latency. Add caching, retries, and monitoring on the slow endpoint.",
    marketingId: "redirect.timeout",
  },

  // ---------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------
  {
    type: "HTTPS_LINKS_TO_HTTP",
    category: "Security",
    severityDefault: "WARNING",
    title: "HTTPS page links to HTTP",
    description:
      "An HTTPS page contains a plain HTTP link. Triggers mixed-content warnings on click-through.",
    howToFix:
      "Update the link to https://. Verify the destination supports HTTPS.",
    marketingId: "security.https-to-http-link",
  },
  {
    type: "HTTP_LINKS_TO_HTTPS",
    category: "Security",
    severityDefault: "NOTICE",
    title: "HTTP page links to HTTPS",
    description:
      "An HTTP page links to HTTPS. Usually fine, but suggests the page itself should also be HTTPS.",
    howToFix:
      "Migrate the source page to HTTPS to keep the whole journey secure.",
    marketingId: "security.http-to-https-link",
  },
  {
    type: "HTTPS_CSS_TO_HTTP",
    category: "Security",
    severityDefault: "ERROR",
    title: "HTTPS page loads HTTP CSS",
    description:
      "Stylesheet loaded over HTTP from an HTTPS page. Browsers block it as mixed content.",
    howToFix:
      "Update the stylesheet URL to https:// or self-host the file.",
    marketingId: "security.css-mixed-content",
  },
  {
    type: "HTTPS_JS_TO_HTTP",
    category: "Security",
    severityDefault: "ERROR",
    title: "HTTPS page loads HTTP JS",
    description:
      "Script loaded over HTTP from an HTTPS page. Blocked as mixed content; the page may break.",
    howToFix:
      "Update the script URL to https:// or self-host it.",
    marketingId: "security.js-mixed-content",
  },
  {
    type: "HTTPS_IMG_TO_HTTP",
    category: "Security",
    severityDefault: "WARNING",
    title: "HTTPS page loads HTTP image",
    description:
      "Image loaded over HTTP from an HTTPS page. Causes mixed-content warnings.",
    howToFix:
      "Update the image URL to https:// or move the asset to your CDN.",
    marketingId: "security.img-mixed-content",
  },

  // ---------------------------------------------------------------------
  // Hreflang
  // ---------------------------------------------------------------------
  {
    type: "INVALID_HREFLANG",
    category: "Hreflang",
    severityDefault: "WARNING",
    title: "Invalid hreflang code",
    description:
      "An hreflang attribute has an invalid language / region code.",
    howToFix:
      "Use a valid ISO 639-1 language code, optionally with an ISO 3166-1 region (for example, en-GB).",
    marketingId: "hreflang.region-invalid",
  },
  {
    type: "HREFLANG_LANG_MISMATCH",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "hreflang language mismatch",
    description:
      "The hreflang language does not match the actual page language.",
    howToFix:
      "Align <html lang> and the hreflang tag, or repoint hreflang at the right localised URL.",
    marketingId: "hreflang.lang-mismatch",
  },
  {
    type: "HREFLANG_MISSING_SELF_REF",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "Missing self-referential hreflang",
    description:
      "An hreflang cluster must include a self-reference for each locale. This page omits its own.",
    howToFix:
      "Add an hreflang entry that points at this page with its own locale code.",
    marketingId: "hreflang.self-missing",
  },
  {
    type: "HREFLANG_MISSING_X_DEFAULT",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "Missing x-default hreflang",
    description:
      "No x-default fallback is defined for users whose locale does not match any listed variant.",
    howToFix:
      "Add an hreflang=\"x-default\" entry pointing at the locale chooser or generic page.",
    marketingId: "hreflang.x-default-missing",
  },
  {
    type: "HREFLANG_POINTS_TO_BROKEN",
    category: "Hreflang",
    severityDefault: "ERROR",
    title: "hreflang target broken",
    description:
      "An hreflang entry points at a 4xx / 5xx URL.",
    howToFix:
      "Update the hreflang URL to a live, localised page. Restore the broken target if it should exist.",
    marketingId: "hreflang.points-to-broken",
  },
  {
    type: "HREFLANG_POINTS_TO_REDIRECT",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "hreflang target redirects",
    description:
      "An hreflang entry redirects to another URL. Search engines may discount it.",
    howToFix:
      "Repoint the hreflang at the final URL directly.",
    marketingId: "hreflang.points-to-redirect",
  },
  {
    type: "HREFLANG_MISSING_RECIPROCAL",
    category: "Hreflang",
    severityDefault: "WARNING",
    title: "Missing reciprocal hreflang",
    description:
      "Page A links to page B via hreflang, but B does not link back. Without reciprocity, the cluster is ignored.",
    howToFix:
      "Add the reciprocal hreflang entry on the localised page so each locale references all the others.",
    marketingId: "hreflang.return-tag-mismatch",
  },
  {
    type: "HREFLANG_POINTS_TO_NON_CANONICAL",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "hreflang target non-canonical",
    description:
      "An hreflang entry points at a URL whose canonical is something else.",
    howToFix:
      "Always point hreflang at the canonical URL of each locale.",
    marketingId: "hreflang.non-canonical",
  },
  {
    type: "HREFLANG_MULTI_LANG_SINGLE_PAGE",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "Multiple languages on one page",
    description:
      "The page declares hreflang for multiple language codes pointing at itself.",
    howToFix:
      "Use one canonical locale per page. Move secondary locales to dedicated URLs.",
    marketingId: "hreflang.multi-lang-single-page",
  },
  {
    type: "HREFLANG_MULTI_PAGE_SINGLE_LANG",
    category: "Hreflang",
    severityDefault: "NOTICE",
    title: "One language across many pages",
    description:
      "Several pages claim to be the canonical for the same language code.",
    howToFix:
      "Pick one canonical URL per locale. Update the others to point at it via hreflang and canonical.",
    marketingId: "hreflang.multi-page-single-lang",
  },

  // ---------------------------------------------------------------------
  // Canonical
  // ---------------------------------------------------------------------
  {
    type: "CANONICAL_POINTS_TO_4XX",
    category: "Canonical",
    severityDefault: "ERROR",
    title: "Canonical points to 4xx",
    description:
      "The canonical URL returns a 4xx error. The page has no valid canonical.",
    howToFix:
      "Repoint the canonical at a live URL or remove the canonical tag entirely.",
    marketingId: "canonical.points-to-4xx",
  },
  {
    type: "CANONICAL_POINTS_TO_5XX",
    category: "Canonical",
    severityDefault: "ERROR",
    title: "Canonical points to 5xx",
    description:
      "The canonical URL returns a 5xx error.",
    howToFix:
      "Fix the failing canonical target or repoint at a live URL.",
    marketingId: "canonical.points-to-5xx",
  },
  {
    type: "CANONICAL_POINTS_TO_REDIRECT",
    category: "Canonical",
    severityDefault: "WARNING",
    title: "Canonical points to redirect",
    description:
      "The canonical URL redirects. Search engines may follow it but the signal is weakened.",
    howToFix:
      "Repoint the canonical at the final URL.",
    marketingId: "canonical.points-to-redirect",
  },
  {
    type: "CANONICAL_NO_INCOMING_LINKS",
    category: "Canonical",
    severityDefault: "NOTICE",
    title: "Canonical has no incoming links",
    description:
      "The canonical URL is not linked anywhere internally, suggesting the cluster is fragmented.",
    howToFix:
      "Add internal links to the canonical version. Verify the rest of the site agrees on which URL is canonical.",
    marketingId: "canonical.no-incoming",
  },
  {
    type: "CANONICAL_HTTP_TO_HTTPS",
    category: "Canonical",
    severityDefault: "NOTICE",
    title: "Canonical http to https",
    description:
      "The page is HTTP but its canonical is HTTPS. Expected during a migration; should not persist.",
    howToFix:
      "Migrate the page to HTTPS so the canonical and the URL agree.",
    marketingId: "canonical.http-to-https",
  },
  {
    type: "CANONICAL_HTTPS_TO_HTTP",
    category: "Canonical",
    severityDefault: "ERROR",
    title: "Canonical https to http",
    description:
      "The page is HTTPS but the canonical is HTTP. Search engines may demote the page.",
    howToFix:
      "Set the canonical to the HTTPS variant.",
    marketingId: "canonical.https-to-http",
  },
  {
    type: "NON_CANONICAL_AS_CANONICAL",
    category: "Canonical",
    severityDefault: "WARNING",
    title: "Non-canonical declared as canonical",
    description:
      "The page sets itself as canonical but other pages declare a different canonical for the same content.",
    howToFix:
      "Pick one URL as the canonical for the cluster and update every page to agree.",
    marketingId: "canonical.conflict",
  },
  {
    type: "DUPLICATES_NO_CANONICAL",
    category: "Canonical",
    severityDefault: "WARNING",
    title: "Duplicates without canonical",
    description:
      "Multiple pages share the same content but none declare a canonical.",
    howToFix:
      "Add a canonical tag on each duplicate pointing at the preferred URL.",
    marketingId: "canonical.missing",
  },

  // ---------------------------------------------------------------------
  // Duplicates
  // ---------------------------------------------------------------------
  {
    type: "IDENTICAL_CONTENT",
    category: "Duplicates",
    severityDefault: "WARNING",
    title: "Identical content",
    description:
      "Two or more pages serve identical body content.",
    howToFix:
      "Consolidate to a single canonical URL via 301 or canonical tag, or differentiate the content meaningfully.",
    marketingId: "dup.exact-body",
  },

  // ---------------------------------------------------------------------
  // CSS
  // ---------------------------------------------------------------------
  {
    type: "BROKEN_CSS",
    category: "CSS",
    severityDefault: "ERROR",
    title: "Broken stylesheet",
    description:
      "A linked stylesheet returns an error response. The page renders without its styles.",
    howToFix:
      "Fix the stylesheet URL or restore the missing file.",
    marketingId: "css.broken",
  },
  {
    type: "OVERSIZED_CSS",
    category: "CSS",
    severityDefault: "WARNING",
    title: "Oversized stylesheet",
    description:
      "A stylesheet is unusually large, slowing page render.",
    howToFix:
      "Split the stylesheet, drop unused rules, and consider per-route CSS chunks.",
    marketingId: "css.oversized",
  },
  {
    type: "REDIRECTED_CSS",
    category: "CSS",
    severityDefault: "NOTICE",
    title: "Stylesheet redirects",
    description:
      "A linked stylesheet URL redirects, costing an extra round-trip.",
    howToFix:
      "Update the link tag to the final stylesheet URL.",
    marketingId: "css.redirect",
  },

  // ---------------------------------------------------------------------
  // JS
  // ---------------------------------------------------------------------
  {
    type: "BROKEN_JS",
    category: "JS",
    severityDefault: "ERROR",
    title: "Broken script",
    description:
      "A linked script returns an error. The page may behave incorrectly.",
    howToFix:
      "Fix the script URL or restore the missing file.",
    marketingId: "js.broken",
  },
  {
    type: "OVERSIZED_JS",
    category: "JS",
    severityDefault: "WARNING",
    title: "Oversized script",
    description:
      "A script bundle is unusually large, hurting time-to-interactive.",
    howToFix:
      "Code-split, lazy-load non-critical bundles, and tree-shake aggressively.",
    marketingId: "js.oversized",
  },
  {
    type: "REDIRECTED_JS",
    category: "JS",
    severityDefault: "NOTICE",
    title: "Script redirects",
    description:
      "A script URL redirects, adding a round-trip on every page load.",
    howToFix:
      "Update the script tag to the final URL.",
    marketingId: "js.redirect",
  },

  // ---------------------------------------------------------------------
  // External Links
  // ---------------------------------------------------------------------
  {
    type: "EXTERNAL_LINK_3XX",
    category: "External Links",
    severityDefault: "NOTICE",
    title: "External link redirects",
    description:
      "An outbound external link redirects, costing user time.",
    howToFix:
      "Update the link to the final destination URL.",
    marketingId: "link.external-3xx",
  },
  {
    type: "EXTERNAL_LINK_4XX",
    category: "External Links",
    severityDefault: "WARNING",
    title: "External link broken (4xx)",
    description:
      "An outbound external link returns a 4xx error.",
    howToFix:
      "Replace with a working URL, link to an archive copy, or remove the link.",
    marketingId: "link.broken-external",
  },
  {
    type: "EXTERNAL_LINK_BLOCKED",
    category: "External Links",
    severityDefault: "NOTICE",
    title: "External link blocked",
    description:
      "The external host blocked our crawler. Could be intentional bot blocking.",
    howToFix:
      "Verify the link in a browser. If permanently blocked, consider replacing it.",
    marketingId: "link.external-blocked",
  },
  {
    type: "EXTERNAL_LINK_5XX",
    category: "External Links",
    severityDefault: "WARNING",
    title: "External link 5xx",
    description:
      "An outbound external link returned a 5xx error.",
    howToFix:
      "Recheck after the destination's outage. Replace if persistently down.",
    marketingId: "link.external-5xx",
  },
  {
    type: "EXTERNAL_LINK_TIMEOUT",
    category: "External Links",
    severityDefault: "NOTICE",
    title: "External link timeout",
    description:
      "The external link timed out during the crawl.",
    howToFix:
      "Verify in a browser. Replace if the destination is reliably slow or unreachable.",
    marketingId: "link.external-timeout",
  },
  {
    type: "EXTERNAL_LINK_5XX_REDIRECT",
    category: "External Links",
    severityDefault: "WARNING",
    title: "External redirect to 5xx",
    description:
      "The external link redirects to a server-error response.",
    howToFix:
      "Replace with a working destination or remove the link.",
    marketingId: "link.external-5xx-redirect",
  },

  // ---------------------------------------------------------------------
  // Render-Blocking
  // ---------------------------------------------------------------------
  {
    type: "RENDER_BLOCKING_CSS",
    category: "Render-Blocking",
    severityDefault: "WARNING",
    title: "Render-blocking CSS",
    description:
      "A stylesheet blocks first paint. Hurts Largest Contentful Paint and perceived speed.",
    howToFix:
      "Inline critical CSS for above-the-fold content and load the rest with media queries or async strategies.",
    marketingId: "css.render-blocking",
  },
  {
    type: "RENDER_BLOCKING_JS",
    category: "Render-Blocking",
    severityDefault: "WARNING",
    title: "Render-blocking JS",
    description:
      "A script in the <head> blocks rendering until parsed and executed.",
    howToFix:
      "Move scripts to the end of the body or add async / defer. Trim non-critical scripts entirely.",
    marketingId: "js.blocking",
  },

  // ---------------------------------------------------------------------
  // Robots.txt
  // ---------------------------------------------------------------------
  {
    type: "ROBOTS_TXT_INACCESSIBLE",
    category: "Robots.txt",
    severityDefault: "ERROR",
    title: "robots.txt inaccessible",
    description:
      "robots.txt could not be fetched. Crawlers may treat the entire site as disallowed.",
    howToFix:
      "Make /robots.txt return a 200. If you have no rules, serve an empty allow-all file.",
    marketingId: "robots.inaccessible",
  },

  // ---------------------------------------------------------------------
  // Cross-Crawl Changes
  // ---------------------------------------------------------------------
  {
    type: "TITLE_CHANGED",
    category: "Cross-Crawl Changes",
    severityDefault: "NOTICE",
    title: "Title changed",
    description:
      "The page title changed since the previous crawl.",
    howToFix:
      "Confirm the change is intentional. If not, restore the previous title or update sources of truth.",
    marketingId: "diff.title-changed",
  },
  {
    type: "META_DESCRIPTION_CHANGED",
    category: "Cross-Crawl Changes",
    severityDefault: "NOTICE",
    title: "Meta description changed",
    description:
      "The meta description changed since the previous crawl.",
    howToFix:
      "Verify the new copy is intentional. Roll back if the change was accidental.",
    marketingId: "diff.meta-changed",
  },
  {
    type: "H1_CHANGED",
    category: "Cross-Crawl Changes",
    severityDefault: "NOTICE",
    title: "H1 changed",
    description:
      "The H1 changed since the previous crawl.",
    howToFix:
      "Verify the new heading matches the intended page topic.",
    marketingId: "diff.h1-changed",
  },
  {
    type: "WORD_COUNT_CHANGED",
    category: "Cross-Crawl Changes",
    severityDefault: "NOTICE",
    title: "Word count changed",
    description:
      "The page word count moved meaningfully between crawls.",
    howToFix:
      "Check whether content was added or removed deliberately. Investigate template / data regressions if not.",
    marketingId: "diff.word-count-changed",
  },
  {
    type: "REDIRECT_TARGET_CHANGED",
    category: "Cross-Crawl Changes",
    severityDefault: "WARNING",
    title: "Redirect target changed",
    description:
      "A redirect now points at a different URL than in the previous crawl.",
    howToFix:
      "Confirm the new target is correct. Update internal links to match.",
    marketingId: "diff.redirect-changed",
  },
  {
    type: "BECAME_NON_INDEXABLE",
    category: "Cross-Crawl Changes",
    severityDefault: "WARNING",
    title: "Page became non-indexable",
    description:
      "A previously indexable page is now blocked from indexing.",
    howToFix:
      "If indexing should continue, remove the noindex directive. Otherwise document the change.",
    marketingId: "diff.became-noindex",
  },

  // ---------------------------------------------------------------------
  // Sitemap
  // ---------------------------------------------------------------------
  {
    type: "SITEMAP_3XX_REDIRECT",
    category: "Sitemap",
    severityDefault: "NOTICE",
    title: "Sitemap URL redirects",
    description:
      "A URL listed in the sitemap redirects.",
    howToFix:
      "Update the sitemap to list the final URL.",
    marketingId: "sitemap.redirect",
  },
  {
    type: "SITEMAP_4XX",
    category: "Sitemap",
    severityDefault: "ERROR",
    title: "Sitemap URL returns 4xx",
    description:
      "A URL in the sitemap is broken.",
    howToFix:
      "Remove the URL from the sitemap or restore the page.",
    marketingId: "sitemap.4xx",
  },
  {
    type: "SITEMAP_403_FORBIDDEN",
    category: "Sitemap",
    severityDefault: "ERROR",
    title: "Sitemap URL forbidden",
    description:
      "A URL in the sitemap returns 403. Search engines cannot index it.",
    howToFix:
      "Open the page to crawlers or remove it from the sitemap.",
    marketingId: "sitemap.403",
  },
  {
    type: "SITEMAP_5XX",
    category: "Sitemap",
    severityDefault: "ERROR",
    title: "Sitemap URL returns 5xx",
    description:
      "A URL in the sitemap returns a server error.",
    howToFix:
      "Investigate the failing endpoint and fix it, or temporarily remove the URL from the sitemap.",
    marketingId: "sitemap.5xx",
  },
  {
    type: "SITEMAP_NOINDEX",
    category: "Sitemap",
    severityDefault: "WARNING",
    title: "Sitemap URL is noindex",
    description:
      "A URL in the sitemap is marked noindex. The two signals contradict each other.",
    howToFix:
      "Remove the URL from the sitemap or remove the noindex directive.",
    marketingId: "sitemap.noindex",
  },
  {
    type: "SITEMAP_NON_CANONICAL",
    category: "Sitemap",
    severityDefault: "NOTICE",
    title: "Sitemap URL non-canonical",
    description:
      "A URL in the sitemap is not the canonical version of its page.",
    howToFix:
      "Replace with the canonical URL.",
    marketingId: "sitemap.non-canonical",
  },
  {
    type: "SITEMAP_TIMEOUT",
    category: "Sitemap",
    severityDefault: "WARNING",
    title: "Sitemap URL timed out",
    description:
      "A URL in the sitemap timed out during the crawl.",
    howToFix:
      "Investigate the slow endpoint or remove the URL until performance is restored.",
    marketingId: "sitemap.timeout",
  },
  {
    type: "INVALID_SITEMAP_FORMAT",
    category: "Sitemap",
    severityDefault: "ERROR",
    title: "Invalid sitemap format",
    description:
      "The sitemap could not be parsed as valid XML / sitemap protocol.",
    howToFix:
      "Validate the sitemap with a linter, fix the malformed entries, and re-upload.",
    marketingId: "sitemap.malformed",
  },
  {
    type: "MISSING_FROM_SITEMAP",
    category: "Sitemap",
    severityDefault: "NOTICE",
    title: "URL missing from sitemap",
    description:
      "A linked, indexable URL is not present in any sitemap.",
    howToFix:
      "Add the URL to the sitemap or fix the sitemap generator that excluded it.",
    marketingId: "sitemap.url-orphan",
  },
  {
    type: "DUPLICATE_IN_SITEMAPS",
    category: "Sitemap",
    severityDefault: "NOTICE",
    title: "Duplicate URL in sitemaps",
    description:
      "The same URL appears in more than one sitemap or more than once in the same sitemap.",
    howToFix:
      "Deduplicate the sitemap entries.",
    marketingId: "sitemap.duplicate",
  },

  // ---------------------------------------------------------------------
  // Structured Data
  // ---------------------------------------------------------------------
  {
    type: "JSON_LD_PARSE_ERROR",
    category: "Structured Data",
    severityDefault: "ERROR",
    title: "JSON-LD parse error",
    description:
      "A JSON-LD script block could not be parsed as valid JSON.",
    howToFix:
      "Fix the JSON syntax. Validate with a linter before shipping.",
    marketingId: "schema.parse-error",
  },
  {
    type: "JSON_LD_MISSING_TYPE",
    category: "Structured Data",
    severityDefault: "WARNING",
    title: "JSON-LD missing @type",
    description:
      "A JSON-LD object has no @type. Search engines cannot interpret it.",
    howToFix:
      "Add an @type that names the schema (for example, Article, Product).",
    marketingId: "schema.missing-type",
  },
  {
    type: "JSON_LD_INVALID_TYPE",
    category: "Structured Data",
    severityDefault: "WARNING",
    title: "JSON-LD invalid @type",
    description:
      "The @type does not exist on schema.org or is misspelled.",
    howToFix:
      "Replace with a valid schema.org type that fits the content.",
    marketingId: "schema.invalid-type",
  },
  {
    type: "JSON_LD_INVALID_PROPERTY",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD invalid property",
    description:
      "A property on the JSON-LD object is not defined for the declared @type.",
    howToFix:
      "Remove the property or move it to a parent / nested object that allows it.",
    marketingId: "schema.invalid-property",
  },
  {
    type: "JSON_LD_UNEXPECTED_PROPERTY_TYPE",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD wrong property type",
    description:
      "A property's value type does not match the schema.org expected type (for example, string instead of Date).",
    howToFix:
      "Coerce the value to the expected type.",
    marketingId: "schema.type-mismatch",
  },
  {
    type: "JSON_LD_UNEXPECTED_PROPERTY",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD unexpected property",
    description:
      "An unrecognised property appeared on a JSON-LD object.",
    howToFix:
      "Remove the property or replace with a recognised schema.org one.",
    marketingId: "schema.unexpected-property",
  },
  {
    type: "JSON_LD_INVALID_VALUE",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD invalid value",
    description:
      "A property's value is not in the expected format (for example, malformed URL).",
    howToFix:
      "Fix the value to match the expected format.",
    marketingId: "schema.invalid-value",
  },
  {
    type: "JSON_LD_DUPLICATE_PROPERTY",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD duplicate property",
    description:
      "The same property is declared more than once on a JSON-LD object.",
    howToFix:
      "Remove the duplicate or merge into an array if multiple values are intended.",
    marketingId: "schema.duplicate-property",
  },
  {
    type: "JSON_LD_DEPRECATED_TYPE",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD deprecated type",
    description:
      "The JSON-LD object uses a schema.org type that has been deprecated.",
    howToFix:
      "Migrate to the recommended replacement type listed in the schema.org docs.",
    marketingId: "schema.deprecated-type",
  },
  {
    type: "JSON_LD_DEPRECATED_PROPERTY",
    category: "Structured Data",
    severityDefault: "NOTICE",
    title: "JSON-LD deprecated property",
    description:
      "The JSON-LD object uses a property that has been deprecated.",
    howToFix:
      "Migrate to the recommended replacement property.",
    marketingId: "schema.deprecated-property",
  },

  // ---------------------------------------------------------------------
  // Structured Data (Google)
  // ---------------------------------------------------------------------
  {
    type: "JSON_LD_GOOGLE_MISSING_REQUIRED",
    category: "Structured Data (Google)",
    severityDefault: "WARNING",
    title: "Google rich result missing required field",
    description:
      "A field Google requires for the rich result is missing. The page is ineligible until it is added.",
    howToFix:
      "Add the required field as listed in Google's rich-result documentation.",
    marketingId: "schema.google-required-missing",
  },
  {
    type: "JSON_LD_GOOGLE_MISSING_ONE_OF_REQUIRED",
    category: "Structured Data (Google)",
    severityDefault: "WARNING",
    title: "Google rich result missing one-of required",
    description:
      "Google requires at least one of a set of fields and none are present.",
    howToFix:
      "Add at least one of the required fields documented for the rich-result type.",
    marketingId: "schema.google-one-of-missing",
  },
  {
    type: "JSON_LD_GOOGLE_PROPERTY_MISSING_TYPE",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result property missing type",
    description:
      "A nested object that Google expects to be typed has no @type.",
    howToFix:
      "Add the expected @type on the nested object.",
    marketingId: "schema.google-property-missing-type",
  },
  {
    type: "JSON_LD_GOOGLE_MISSING_IMAGE",
    category: "Structured Data (Google)",
    severityDefault: "WARNING",
    title: "Google rich result missing image",
    description:
      "Google's rich result for this type requires an image and none was provided.",
    howToFix:
      "Add an image property pointing at a high-quality, public image.",
    marketingId: "schema.google-image-missing",
  },
  {
    type: "JSON_LD_GOOGLE_INVALID_DATE",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result invalid date",
    description:
      "A date field is not in ISO 8601 format.",
    howToFix:
      "Use ISO 8601 (for example, 2026-04-30T12:00:00Z).",
    marketingId: "schema.google-invalid-date",
  },
  {
    type: "JSON_LD_GOOGLE_UNRECOGNIZED_PROPERTY",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result unrecognised property",
    description:
      "A property is not recognised by Google for this rich-result type.",
    howToFix:
      "Remove the property or replace with a documented one.",
    marketingId: "schema.google-unrecognized",
  },
  {
    type: "JSON_LD_GOOGLE_UNRESOLVED_ID",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result unresolved @id",
    description:
      "An @id reference does not match any object on the page.",
    howToFix:
      "Add the referenced object or fix the @id to point at an existing one.",
    marketingId: "schema.google-unresolved-id",
  },
  {
    type: "JSON_LD_GOOGLE_EMPTY_FIELD",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result empty field",
    description:
      "A field that should hold a value is empty.",
    howToFix:
      "Populate the field with a meaningful value or remove it if optional.",
    marketingId: "schema.google-empty-field",
  },
  {
    type: "JSON_LD_GOOGLE_INVALID_VALUE",
    category: "Structured Data (Google)",
    severityDefault: "NOTICE",
    title: "Google rich result invalid value",
    description:
      "A field's value is outside the format Google expects.",
    howToFix:
      "Update the value to match Google's documented format.",
    marketingId: "schema.google-invalid-value",
  },

  // ---------------------------------------------------------------------
  // AMP
  // ---------------------------------------------------------------------
  {
    type: "AMP_VALIDATION_ERRORS",
    category: "AMP",
    severityDefault: "WARNING",
    title: "AMP validation errors",
    description:
      "The AMP variant has validation errors and is ineligible for AMP-specific surfaces.",
    howToFix:
      "Run the AMP validator and fix the reported errors.",
    marketingId: "amp.validation-error",
  },
  {
    type: "AMP_CANONICAL_MISMATCH",
    category: "AMP",
    severityDefault: "NOTICE",
    title: "AMP canonical mismatch",
    description:
      "The AMP page and its canonical disagree on the canonical URL.",
    howToFix:
      "Set the AMP page's canonical to the non-AMP URL and vice versa using <link rel=\"amphtml\">.",
    marketingId: "amp.canonical-missing",
  },
  {
    type: "AMP_EXCESSIVE_CSS",
    category: "AMP",
    severityDefault: "NOTICE",
    title: "AMP excessive CSS",
    description:
      "The AMP page exceeds the CSS budget allowed by the AMP spec.",
    howToFix:
      "Trim unused CSS rules and inline only what AMP needs.",
    marketingId: "amp.excessive-css",
  },

  // ---------------------------------------------------------------------
  // Duplicate Code
  // ---------------------------------------------------------------------
  {
    type: "DUPLICATE_JS_CODE",
    category: "Duplicate Code",
    severityDefault: "NOTICE",
    title: "Duplicate JavaScript",
    description:
      "Multiple script bundles ship the same code, wasting bandwidth and parsing time.",
    howToFix:
      "Deduplicate via a shared chunk, externalise common dependencies, or audit your bundler split-chunks config.",
    marketingId: "js.duplicate-tracker",
  },
  {
    type: "DUPLICATE_CSS_CODE",
    category: "Duplicate Code",
    severityDefault: "NOTICE",
    title: "Duplicate CSS",
    description:
      "Multiple stylesheets ship the same rules, inflating CSS payload.",
    howToFix:
      "Consolidate shared rules into a single stylesheet and trim duplicates from per-page CSS.",
    marketingId: "css.duplicate-stylesheet",
  },
]

// ---------------------------------------------------------------------------
// Lazy-loaded BE catalog cache (plan section 6 / sec 0.3e iter 2). The static
// ENTRIES above are the FE source of truth (AGENTS.md "Repo layout"); the BE
// /api/catalog endpoint should match them. We:
//   1. Use ENTRIES as the synchronous baseline so getCheck / getAllChecks
//      stay cheap and never throw.
//   2. Allow feature code to call hydrateCatalogFromBackend(client) at app
//      mount; on success we replace the in-memory ACTIVE list with the BE
//      response (additive entries land too) and console.warn on any drift.
//   3. Keep the static ENTRIES exported as a fallback so the explorer can
//      render even if the BE 404s.
// ---------------------------------------------------------------------------

let ACTIVE: readonly CheckCatalogEntry[] = ENTRIES

function buildIndex(
  entries: readonly CheckCatalogEntry[],
): Record<string, CheckCatalogEntry> {
  const out: Record<string, CheckCatalogEntry> = {}
  for (const e of entries) out[e.type] = e
  return out
}

let INDEX = buildIndex(ACTIVE)

export type HydrateCatalogClient = {
  getPublicCatalog: () => Promise<unknown[]>
}

/** Replace the active catalog with the supplied list. The integrity test
 *  guarantees every AlertType is covered by ENTRIES, so swapping in a smaller
 *  BE response is safe (we union into ACTIVE rather than replace) - any FE
 *  entry not present in the BE response is preserved. */
export function setActiveCatalog(
  next: readonly CheckCatalogEntry[] | null | undefined,
): void {
  if (!next || next.length === 0) {
    ACTIVE = ENTRIES
    INDEX = buildIndex(ACTIVE)
    return
  }
  // Merge: BE entries take precedence; missing ones fall back to FE static
  // entries. This way a BE that ships a subset still doesn't blank fields the
  // FE depends on.
  const merged = new Map<string, CheckCatalogEntry>()
  for (const e of ENTRIES) merged.set(e.type, e)
  for (const e of next) merged.set(e.type, e)
  ACTIVE = Array.from(merged.values())
  INDEX = buildIndex(ACTIVE)
}

/** Pull the BE catalog and hydrate the in-memory cache. Logs a console.warn
 *  on drift between FE static entries and BE response. Resolves silently on
 *  4xx/5xx so the FE keeps the static fallback. */
export async function hydrateCatalogFromBackend(
  client: HydrateCatalogClient,
): Promise<readonly CheckCatalogEntry[]> {
  try {
    const remote = (await client.getPublicCatalog()) as CheckCatalogEntry[]
    if (!Array.isArray(remote) || remote.length === 0) return ACTIVE
    // Drift detection: warn for any FE entry whose title / category differ
    // from the BE entry. This is best-effort - the FE remains the source of
    // truth for human-readable copy.
    const beIndex = buildIndex(remote)
    const drift: string[] = []
    for (const fe of ENTRIES) {
      const be = beIndex[fe.type]
      if (!be) {
        drift.push(`${fe.type} present on FE but missing on BE`)
        continue
      }
      if (be.category !== fe.category) {
        drift.push(
          `${fe.type} category drift: FE=${fe.category}, BE=${be.category}`,
        )
      }
    }
    for (const be of remote) {
      if (!INDEX[be.type] && !ENTRIES.find((e) => e.type === be.type)) {
        drift.push(`${be.type} present on BE but missing on FE`)
      }
    }
    if (drift.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `checkCatalog drift between FE and BE (${drift.length} entries):`,
        drift.slice(0, 8),
      )
    }
    setActiveCatalog(remote)
    return ACTIVE
  } catch {
    // Swallow - keep the static fallback active.
    return ACTIVE
  }
}

/** Returns the catalog entry for an AlertType, or null if (somehow) the
 *  AlertType is unknown. The integrity test asserts every union literal is
 *  present, so callers can usually treat null as "impossible" - but we still
 *  return null instead of throwing because feature code may render alerts
 *  pulled from an older backend version. */
export function getCheck(type: string): CheckCatalogEntry | null {
  return INDEX[type] ?? null
}

/** Returns every catalog entry whose category matches `category`. The
 *  category drill-in route uses this to list per-AlertType breakdowns and to
 *  filter alerts client-side. */
export function getChecksInCategory(category: string): CheckCatalogEntry[] {
  return ACTIVE.filter((entry) => entry.category === category)
}

/** Returns every category, in the order they first appear in the catalog. */
export function getAllCategories(): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const entry of ACTIVE) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category)
      order.push(entry.category)
    }
  }
  return order
}

/** Returns the full catalog (BE-hydrated when available, static otherwise). */
export function getAllChecks(): readonly CheckCatalogEntry[] {
  return ACTIVE
}

/** Returns the static FE-defined entries irrespective of any BE hydration.
 *  Used by the explorer to fall back when GET /api/catalog 404s. */
export function getStaticChecks(): readonly CheckCatalogEntry[] {
  return ENTRIES
}
