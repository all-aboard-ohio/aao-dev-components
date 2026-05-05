/**
 * <aao-banner> — All Aboard Ohio shared notification banner
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
