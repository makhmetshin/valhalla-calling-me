import { clear, el } from './dom.js';
import { state } from './state.js';

const backdrop = document.getElementById('backdrop');

export function applyBackground(routeName) {
  const config = (state.preferences.backgrounds || {})[routeName]
    || (state.preferences.backgrounds || {}).default;

  clear(backdrop);
  backdrop.style.backgroundImage = '';
  backdrop.style.filter = '';
  backdrop.style.opacity = '1';

  if (!config || !config.url) return;

  backdrop.style.filter = `brightness(${config.dim ?? 0.7}) blur(${config.blur ?? 0}px)`;

  if (config.kind === 'video') {
    backdrop.append(
      el('video', {
        src: config.url,
        autoplay: true,
        loop: true,
        muted: true,
        playsInline: true,
      })
    );
  } else {
    backdrop.style.backgroundImage = `url("${config.url}")`;
  }
}

export function applyFonts() {
  const heading = state.preferences['theme.font_heading'];
  const body = state.preferences['theme.font_body'];
  const accent = state.preferences['theme.accent'];
  const style = document.getElementById('userTheme') || el('style', { id: 'userTheme' });
  const rules = [];

  if (heading) {
    rules.push(`@font-face { font-family: "UserHead"; src: url("${heading}"); font-display: swap; }`);
  }
  if (body) {
    rules.push(`@font-face { font-family: "UserBody"; src: url("${body}"); font-display: swap; }`);
  }
  rules.push(
    `:root {${heading ? ' --font-head: "UserHead", Georgia, serif;' : ''}${
      body ? ' --font-body: "UserBody", "Segoe UI", sans-serif;' : ''
    }${accent ? ` --frost: ${accent};` : ''}}`
  );

  style.textContent = rules.join('\n');
  if (!style.isConnected) document.head.append(style);
}
