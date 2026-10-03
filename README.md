# Worklane Astro reconstruction

A native Astro port of the captured Worklane Framer site. The production build contains reusable Astro components, local assets, focused Motion-powered behavior, and all 17 captured routes. It does not embed or depend on the Framer runtime or the reconstruction capsule.

## Development

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run verify
```

That command runs Astro diagnostics, builds all 17 explicit routes, exercises the 28 route/behavior checks, and then runs the 16 source-motion contracts.

## Evidence workflow

The original export is intentionally kept outside the production project. To rebuild the ignored `.evidence/` audit cache and verify/localize captured assets:

```bash
npm run evidence:extract -- /absolute/path/to/standalone.html
```

The extractor streams the schema-v2 capsule, validates each deduplicated body by SHA-256 and byte count, localizes production media/fonts, and decodes route/state screenshots without loading the 542 MB document as one JavaScript string.

To compare the production build with all 72 captured route/viewport pages and 280 viewport states, start Astro's production preview in one terminal:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4352
```

Then run the comparison in another terminal:

```bash
E2E_BASE_URL=http://127.0.0.1:4352 npm run visual:compare
```

Visual results and diffs are written under `.evidence/`. The 51 desktop/tablet/mobile full-page results remain in `visual-report.json`; the complete 72-page and 280-state matrix is in `visual-state-report.json`. After build, browser, and visual verification, reconcile the completion ledger with:

```bash
npm run tracker:reconcile
```

Reconciliation is deliberately fail-closed: it requires the complete 51-capture route matrix, all explicit route files, no unexpected runtime errors, and every capture at or below the configured visual threshold. A targeted or failing report cannot mark the tracker complete.

## Form destinations

The captured Framer forms have no HTML `action`; their submissions depend on Framer's client runtime. The Astro rebuild needs explicit destinations to deliver entries.

Each form can use an optional build-time environment variable containing its real POST URL:

| Form | Variable |
| --- | --- |
| Contact | `PUBLIC_CONTACT_FORM_ENDPOINT` |
| Request a demo | `PUBLIC_REQUEST_DEMO_FORM_ENDPOINT` |
| Waitlist | `PUBLIC_WAITLIST_FORM_ENDPOINT` |
| Footer newsletter | `PUBLIC_NEWSLETTER_FORM_ENDPOINT` |

Set only the destinations that exist, then rebuild the site. Relative same-origin URLs and absolute URLs are supported. These `PUBLIC_` values appear in the rendered HTML, so they must not contain secrets. This static Astro project does not provide a submission backend.

The browser sends each configured form as `FormData` with `POST`. The receiving endpoint must accept the rendered field names and return an HTTP 2xx response when it accepts a submission. Cross-origin destinations must permit browser CORS requests. A 2xx response shows that the endpoint responded successfully; it does not establish downstream delivery. Non-2xx responses and network errors show a failure message. The newsletter includes `consent=yes` when its optional checkbox is checked.

When a variable is unset, that form has no `action`; the client script prevents submission and displays that the details have not been sent. The form retains `method="POST"` so a browser without JavaScript does not put entered details in the page URL.

## Structure

- `src/layouts/BaseLayout.astro` — shared metadata and page shell
- `src/components/` — shared navigation, footer, controls, FAQ, and cards
- `src/components/home/` — the 11 landing-page sections grouped by source bundle
- `src/pages/` — one explicit `.astro` page for every captured URL, including each individual blog article
- `src/scripts/site.ts` — focused menu, accordion, tabs, form, and reveal behavior
- `public/assets/` — SHA-verified localized source imagery and fonts
- `tests/` — route and interaction acceptance checks
