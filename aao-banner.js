/**
 * aao-banner.js — All Aboard Ohio shared UI components
 *
 * Two custom elements:
 *
 *   <aao-site-header>
 *     Branded AAO attribution header. Use at the top (and/or bottom) of any
 *     AAO developer program site to identify it as part of the ecosystem.
 *
 *     Modes:  standard (default) | compact
 *     Attrs:  mode, banner-id, dev-url, main-url
 *
 *   <aao-notification>
 *     Notification / announcement bar. Reads from a central config JSON
 *     or inline attributes. Place below <aao-site-header> or below your nav.
 *
 *     Modes:  standard (default) | lite | dark
 *     Types:  info (default) | warning | success
 *     Attrs:  mode, config-url, inline, banner-id, message, link, link-text, type
 *
 * Quick start (any stack):
 *   <script type="module" src="https://all-aboard-ohio.github.io/aao-dev-components/aao-banner.js"></script>
 *   <aao-site-header></aao-site-header>
 *   <aao-notification config-url="https://raw.githubusercontent.com/all-aboard-ohio/aao-dev-components/main/banner.json"></aao-notification>
 */

// ─── Shared utilities ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'aao-dismissed-';

const TRAIN_SVG = (size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>`;

const ARROW_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;

const X_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const NOTIF_ICONS = {
  info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

function isDismissed(id) {
  try { return localStorage.getItem(STORAGE_KEY + id) === '1'; } catch { return false; }
}
function saveDismiss(id) {
  try { localStorage.setItem(STORAGE_KEY + id, '1'); } catch {}
}
function collapse(el, onDone) {
  el.style.maxHeight = el.scrollHeight + 'px';
  requestAnimationFrame(() => {
    el.style.transition = 'max-height 0.28s ease, opacity 0.28s ease, padding 0.28s ease';
    el.style.maxHeight = '0';
    el.style.opacity = '0';
    el.style.overflow = 'hidden';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
  });
  setTimeout(onDone, 310);
}

// ─── <aao-site-header> ────────────────────────────────────────────────────────

class AaoSiteHeader extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute('mode') || 'standard';
    const id   = this.getAttribute('banner-id') || `site-header-${mode}`;
    if (isDismissed(id)) return;
    const devUrl  = this.getAttribute('dev-url')  || 'https://dev.allaboardohio.org';
    const mainUrl = this.getAttribute('main-url') || 'https://allaboardohio.org';
    mode === 'compact' ? this._compact(id, devUrl, mainUrl) : this._standard(id, devUrl, mainUrl);
  }

  _dismiss(id) {
    saveDismiss(id);
    const el = this.shadowRoot.querySelector('.root');
    if (el) collapse(el, () => this.remove());
  }

  _standard(id, devUrl, mainUrl) {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .root {
          background: #012345;
          border-bottom: 2px solid #B72717;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          flex-shrink: 0;
        }
        .brand-icon { color: #388CBB; display: flex; }
        .brand-name {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .brand-sub {
          font-size: 10.5px;
          font-weight: 600;
          color: #7cb9d4;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        a.btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
          padding: 5px 13px;
          border-radius: 999px;
          border: 1.5px solid transparent;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        a.btn-primary {
          background: #B72717;
          border-color: #B72717;
          color: #fff;
        }
        a.btn-primary:hover { background: #d42e1a; border-color: #d42e1a; }
        a.btn-ghost {
          background: transparent;
          border-color: rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.8);
        }
        a.btn-ghost:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.4); }
        .dismiss {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
          margin-left: 2px;
          flex-shrink: 0;
          line-height: 1;
        }
        .dismiss:hover { color: rgba(255,255,255,0.8); }
      </style>
      <div class="root">
        <div class="brand">
          <span class="brand-icon">${TRAIN_SVG(22)}</span>
          <div>
            <div class="brand-name">All Aboard Ohio</div>
            <div class="brand-sub">Developer Program</div>
          </div>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="${devUrl}" target="_blank" rel="noopener noreferrer">Developer Portal ${ARROW_SVG}</a>
          <a class="btn btn-ghost"   href="${mainUrl}" target="_blank" rel="noopener noreferrer">allaboardohio.org ${ARROW_SVG}</a>
          <button class="dismiss" aria-label="Dismiss">${X_SVG}</button>
        </div>
      </div>`;
    this.shadowRoot.querySelector('.dismiss').addEventListener('click', () => this._dismiss(id));
  }

  _compact(id, devUrl, mainUrl) {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .root {
          background: #012345;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 5px 40px 5px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 6px 10px;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 12px;
          color: rgba(255,255,255,0.65);
          position: relative;
          text-align: center;
        }
        .flag { display: inline-flex; align-items: center; gap: 6px; }
        .flag svg { opacity: 0.6; flex-shrink: 0; }
        strong { color: rgba(255,255,255,0.88); font-weight: 600; }
        .sep { opacity: 0.2; padding: 0 2px; }
        a { color: #7cb9d4; font-weight: 600; text-decoration: none; white-space: nowrap; }
        a:hover { text-decoration: underline; }
        .dismiss {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
          line-height: 1;
        }
        .dismiss:hover { color: rgba(255,255,255,0.75); }
      </style>
      <div class="root">
        <span class="flag">
          ${TRAIN_SVG(13)}
          <span>An official tool of the <strong>All Aboard Ohio Developer Program</strong></span>
        </span>
        <span class="sep">|</span>
        <a href="${devUrl}"  target="_blank" rel="noopener noreferrer">Developer Portal</a>
        <span class="sep">·</span>
        <a href="${mainUrl}" target="_blank" rel="noopener noreferrer">allaboardohio.org</a>
        <button class="dismiss" aria-label="Dismiss">${X_SVG}</button>
      </div>`;
    this.shadowRoot.querySelector('.dismiss').addEventListener('click', () => this._dismiss(id));
  }
}

customElements.define('aao-site-header', AaoSiteHeader);

// ─── <aao-notification> ───────────────────────────────────────────────────────

const NOTIF_THEMES = {
  standard: { bg: '#FBF3E3', border: '#e8d9b8', text: '#012345', link: '#B72717', dismiss: '#999', icon: '#388CBB' },
  lite:     { bg: '#eef6fc', border: '#c5dff0', text: '#012345', link: '#388CBB', dismiss: '#aab', icon: '#388CBB' },
  dark:     { bg: '#012345', border: '#1a3a5c', text: '#ffffff', link: '#7cb9d4', dismiss: '#6a8fa8', icon: '#388CBB' },
};

class AaoNotification extends HTMLElement {
  connectedCallback() {
    if (this.hasAttribute('inline')) {
      this._render({
        active:   true,
        id:       this.getAttribute('banner-id') || 'inline-notif',
        message:  this.getAttribute('message') || '',
        link:     this.getAttribute('link') || '',
        linkText: this.getAttribute('link-text') || 'Learn more',
        type:     this.getAttribute('type') || 'info',
      });
      return;
    }
    const url = this.getAttribute('config-url');
    if (!url) return;
    fetch(url).then(r => r.json()).then(c => this._render(c)).catch(() => {});
  }

  _render(config) {
    if (!config.active) return;
    if (isDismissed(config.id)) return;
    const mode  = this.getAttribute('mode') || 'standard';
    const theme = NOTIF_THEMES[mode] || NOTIF_THEMES.standard;
    const icon  = NOTIF_ICONS[config.type] || NOTIF_ICONS.info;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .root {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: ${theme.bg};
          border-bottom: 1px solid ${theme.border};
          color: ${theme.text};
          padding: 10px 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 13.5px;
          line-height: 1.4;
          box-sizing: border-box;
        }
        .icon  { color: ${theme.icon}; display: flex; align-items: center; flex-shrink: 0; }
        .msg   { flex: 1; text-align: center; max-width: 860px; }
        a      { color: ${theme.link}; font-weight: 600; text-decoration: none; white-space: nowrap; }
        a:hover { text-decoration: underline; }
        .dismiss {
          background: none; border: none; cursor: pointer;
          color: ${theme.dismiss}; display: flex; align-items: center;
          padding: 4px; border-radius: 4px; flex-shrink: 0; margin-left: 6px; line-height: 1;
        }
        .dismiss:hover { color: ${theme.text}; }
      </style>
      <div class="root" role="status" aria-live="polite">
        <span class="icon">${icon}</span>
        <span class="msg">${config.message}${config.link
          ? ` &nbsp;<a href="${config.link}" target="_blank" rel="noopener noreferrer">${config.linkText || 'Learn more'} →</a>`
          : ''}</span>
        <button class="dismiss" aria-label="Dismiss notification">${X_SVG}</button>
      </div>`;
    this.shadowRoot.querySelector('.dismiss').addEventListener('click', () => {
      saveDismiss(config.id);
      const el = this.shadowRoot.querySelector('.root');
      if (el) collapse(el, () => this.remove());
    });
  }
}

customElements.define('aao-notification', AaoNotification);

// ─── <aao-banner> kept as alias for aao-notification (backward compat) ────────
class AaoBannerCompat extends AaoNotification {}
try { customElements.define('aao-banner', AaoBannerCompat); } catch {}

 *
 * Attributes:
 *   config-url  URL to a JSON config file (see banner.json for schema)
 *   mode        "compact" | "lite" | "standard" | "dark"  (default: "standard")
 *   inline      If present, skips the config fetch and uses inline attributes:
 *               message, link, link-text, banner-id
 *
 * Config JSON schema:
 *   {
 *     "active": true,
 *     "id": "unique-banner-id",
 *     "message": "Notification text",
 *     "link": "https://...",         (optional)
 *     "linkText": "Learn more",      (optional, defaults to "Learn more")
 *     "type": "info" | "warning" | "success"  (optional, default "info")
 *   }
 *
 * Usage (any HTML/framework):
 *   <script type="module" src="https://all-aboard-ohio.github.io/aao-dev-components/aao-banner.js"></script>
 *   <aao-banner config-url="https://raw.githubusercontent.com/all-aboard-ohio/aao-site-config/main/banner.json"></aao-banner>
 *
 * Compact mode (government-style bar, no config fetch needed):
 *   <aao-banner mode="compact"></aao-banner>
 */

const STORAGE_KEY_PREFIX = 'aao-banner-dismissed-';

const THEMES = {
  standard: {
    bg: '#FBF3E3',
    border: '#e8d9b8',
    text: '#012345',
    link: '#B72717',
    dismiss: '#888',
    icon: '#388CBB',
  },
  lite: {
    bg: '#f0f7ff',
    border: '#c8dff0',
    text: '#012345',
    link: '#388CBB',
    dismiss: '#aab',
    icon: '#388CBB',
  },
  dark: {
    bg: '#012345',
    border: '#1a3a5c',
    text: '#ffffff',
    link: '#7ec8e3',
    dismiss: '#7a9ab8',
    icon: '#388CBB',
  },
  compact: {
    bg: '#012345',
    border: 'transparent',
    text: '#e8edf2',
    link: '#7ec8e3',
    dismiss: '#7a9ab8',
    icon: '#388CBB',
  },
};

const TYPE_ICONS = {
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

const DISMISS_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

class AaoBanner extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute('mode') || 'standard';

    if (mode === 'compact') {
      this._renderCompact();
      return;
    }

    if (this.hasAttribute('inline')) {
      const config = {
        active: true,
        id: this.getAttribute('banner-id') || 'inline',
        message: this.getAttribute('message') || '',
        link: this.getAttribute('link') || '',
        linkText: this.getAttribute('link-text') || 'Learn more',
        type: this.getAttribute('type') || 'info',
      };
      this._render(config, mode);
      return;
    }

    const configUrl = this.getAttribute('config-url');
    if (!configUrl) return;

    fetch(configUrl)
      .then((r) => r.json())
      .then((config) => this._render(config, mode))
      .catch(() => {/* silently fail — banner is non-critical */});
  }

  _isDismissed(id) {
    try {
      return localStorage.getItem(STORAGE_KEY_PREFIX + id) === '1';
    } catch {
      return false;
    }
  }

  _dismiss(id) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + id, '1');
    } catch { /* ignore */ }
    const el = this.shadowRoot?.querySelector('.banner') || this.querySelector('.banner');
    if (el) {
      el.style.maxHeight = el.scrollHeight + 'px';
      requestAnimationFrame(() => {
        el.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
        el.style.maxHeight = '0';
        el.style.opacity = '0';
        el.style.overflow = 'hidden';
      });
      setTimeout(() => this.remove(), 350);
    }
  }

  _render(config, mode) {
    if (!config.active) return;
    if (this._isDismissed(config.id)) return;

    const theme = THEMES[mode] || THEMES.standard;
    const icon = TYPE_ICONS[config.type] || TYPE_ICONS.info;
    const isCompact = mode === 'compact';

    const padding = isCompact ? '8px 16px' : '12px 16px';
    const fontSize = isCompact ? '13px' : '14px';

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; box-sizing: border-box; }
        .banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: ${theme.bg};
          border-bottom: 1px solid ${theme.border};
          color: ${theme.text};
          padding: ${padding};
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: ${fontSize};
          line-height: 1.4;
          box-sizing: border-box;
          position: relative;
        }
        .icon { color: ${theme.icon}; display: flex; align-items: center; flex-shrink: 0; }
        .message { flex: 1; text-align: center; max-width: 900px; }
        .link {
          color: ${theme.link};
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }
        .link:hover { text-decoration: underline; }
        .dismiss {
          background: none;
          border: none;
          cursor: pointer;
          color: ${theme.dismiss};
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
          flex-shrink: 0;
          line-height: 1;
          margin-left: 8px;
        }
        .dismiss:hover { color: ${theme.text}; }
      </style>
      <div class="banner" role="status" aria-live="polite">
        <span class="icon">${icon}</span>
        <span class="message">
          ${config.message}${config.link ? ` &nbsp;<a class="link" href="${config.link}" target="_blank" rel="noopener noreferrer">${config.linkText || 'Learn more'} →</a>` : ''}
        </span>
        <button class="dismiss" aria-label="Dismiss notification">${DISMISS_ICON}</button>
      </div>
    `;

    this.shadowRoot.querySelector('.dismiss').addEventListener('click', () => {
      this._dismiss(config.id);
    });
  }

  _renderCompact() {
    const theme = THEMES.compact;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; box-sizing: border-box; }
        .banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: ${theme.bg};
          color: ${theme.text};
          padding: 7px 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.01em;
          text-align: center;
          border-bottom: 1px solid #1a3a5c;
          box-sizing: border-box;
        }
        .label { opacity: 0.75; }
        .sep { opacity: 0.3; }
        .link {
          color: ${theme.link};
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }
        .link:hover { text-decoration: underline; }
        .flag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          opacity: 0.9;
        }
        .flag svg { flex-shrink: 0; }
      </style>
      <div class="banner" role="banner">
        <span class="flag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${theme.icon}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18"/><path d="M3 12h13"/><path d="M3 3l13 4.5L3 12"/></svg>
          <span class="label">An official site of the</span>
          <strong>All Aboard Ohio Developer Program</strong>
        </span>
        <span class="sep">|</span>
        <a class="link" href="https://github.com/all-aboard-ohio" target="_blank" rel="noopener noreferrer">Learn more →</a>
      </div>
    `;
  }
}

customElements.define('aao-banner', AaoBanner);
