# Production polish checklist

Apply to every web-facing change. Before calling work done, verify each item and fix what fails. Do not leave junk behind.

## Domain, SEO and metadata
- Never ship on a preview domain (`*.vercel.app`, `*.pages.dev`, etc.); use the production domain in all absolute URLs.
- Every page has a unique, descriptive `<title>` (no generic or framework-default titles).
- Every page has a meta description.
- Every page has a canonical URL.
- Provide a custom favicon (not the framework default), plus Apple touch and Android icons.
- Provide Open Graph and Twitter card tags, including an OG image, and check that social previews render.
- Provide `sitemap.xml` and `robots.txt`.

## Content structure and accessibility
- Exactly one `<h1>` per page; headings nest in order.
- Every `<img>` has meaningful alt text (empty alt only for decorative images).
- No dead buttons or links: every control does something, every link resolves.

## States and errors
- Custom, on-brand 404 page.
- Designed loading states (skeletons or branded spinners), not bare defaults.
- Specific, actionable error messages and error boundaries; no raw or generic "Something went wrong".

## Code hygiene
- No console errors or warnings in the browser at runtime.
- Remove leftover `console.log` / `debugger` before finishing.
- Do not expose source maps in production builds.
- Keep JS bundles small: code-split, lazy-load, drop unused dependencies, and check bundle size after adding deps.
- Keep files organised in their proper folders; delete unused files, dead code and scratch artifacts.

## UI quality
- Layouts work at mobile widths (check ~375px) with no horizontal scroll.
- Use consistent spacing from the design tokens or scale; no one-off magic values.
