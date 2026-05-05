# aao-dev-components

Shared UI components for All Aboard Ohio developer sites. Framework-agnostic Web Components — drop into any project regardless of stack.

---

## `<aao-banner>`

A notification banner that fetches its content from a central GitHub-hosted JSON config. Supports four display modes.

### Quick start

```html
<!-- 1. Load the component (works in any HTML page or framework) -->
<script type="module" src="https://all-aboard-ohio.github.io/aao-dev-components/aao-banner.js"></script>

<!-- 2. Drop the element wherever you want the banner to appear (usually just below <body> or below your site's nav) -->
<aao-banner
  config-url="https://raw.githubusercontent.com/all-aboard-ohio/aao-dev-components/main/banner.json"
  mode="standard"
></aao-banner>
```

To publish a banner across all AAO sites, edit `banner.json` in this repo and set `"active": true`. To hide it, set `"active": false`. No code deploys needed on consumer sites.

---

### Modes

| Mode | Description |
|------|-------------|
| `standard` | Default. Beige/warm background with icon, message, optional link, dismiss button. |
| `lite` | Light blue tint. Subtle, low-visual-weight. |
| `dark` | AAO dark blue background with white text. High contrast. |
| `compact` | Government-style attribution bar: *"An official site of the All Aboard Ohio Developer Program · Learn more →"* No config fetch — always renders. |

```html
<!-- Compact mode — no config needed, always visible -->
<aao-banner mode="compact"></aao-banner>

<!-- Dark mode pulling from config -->
<aao-banner config-url="..." mode="dark"></aao-banner>

<!-- Inline mode — skip config fetch, supply data as attributes -->
<aao-banner
  inline
  mode="lite"
  banner-id="my-banner-v1"
  message="New route data is available."
  link="https://example.com"
  link-text="View routes"
  type="success"
></aao-banner>
```

---

### Config JSON schema

```json
{
  "active": true,
  "id": "banner-2026-05",
  "message": "Economic Impact Calculator is now live!",
  "link": "https://...",
  "linkText": "Open the tool",
  "type": "info"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `active` | yes | `true` / `false` — gates rendering |
| `id` | yes | unique string — used as localStorage dismiss key |
| `message` | yes | plain text notification message |
| `link` | no | URL for the call-to-action |
| `linkText` | no | CTA label (defaults to "Learn more") |
| `type` | no | `"info"` (default) / `"warning"` / `"success"` |

---

### Dismiss behavior

Users can dismiss any `standard`, `lite`, or `dark` banner. The dismissal is stored in `localStorage` keyed by the banner's `id`. Changing the `id` in `banner.json` causes the banner to reappear for all users — useful for new announcements.

---

### React usage

```jsx
// Works as-is — React passes unknown elements through to the DOM
import 'https://all-aboard-ohio.github.io/aao-dev-components/aao-banner.js';

export function Layout({ children }) {
  return (
    <>
      <aao-banner config-url="..." mode="standard" />
      <Header />
      {children}
      <Footer />
      <aao-banner mode="compact" />
    </>
  );
}
```

---

### Footer placement

The `compact` mode is designed for footer use — it attributes the site to the AAO Developer Program without taking up visual space.

```html
<aao-banner mode="compact"></aao-banner>
```
