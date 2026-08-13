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
