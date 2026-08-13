import { applyBackground } from './backgrounds.js';
import { clear, el, glyph, mount } from './dom.js';
import { t } from './i18n.js';
import { toast } from './toast.js';

const view = document.getElementById('view');
const titleNode = document.getElementById('viewTitle');
const subtitleNode = document.getElementById('viewSubtitle');
const actionsNode = document.getElementById('viewActions');
const navNode = document.getElementById('nav');

let routes = [];
let current = null;

export function registerRoutes(definitions) {
  routes = definitions;
  renderNav();
}

export function currentRoute() {
  return current;
}

function renderNav() {
  mount(
    navNode,
    routes.map((route) =>
      el(
        'button',
        {
          dataset: { route: route.name },
          onclick: () => navigate(route.name),
        },
        glyph(route.icon),
        el('span', { text: route.title }),
        el('span', { class: 'badge', dataset: { badge: route.name }, style: { display: 'none' } })
      )
    )
  );
}

export function setBadge(routeName, value) {
  const node = navNode.querySelector(`[data-badge="${routeName}"]`);
  if (!node) return;
  node.textContent = value;
  node.style.display = value ? '' : 'none';
}

export function setHeader(title, subtitle, actions = []) {
  titleNode.textContent = title;
  subtitleNode.textContent = subtitle || '';
  mount(actionsNode, actions);
}

export async function navigate(name, params = {}) {
  const route = routes.find((item) => item.name === name) || routes[0];
  if (!route) return;
  const hash = buildHash(route.name, params);
  if (window.location.hash !== hash) {
    window.location.hash = hash;
    return;
  }
  await render(route, params);
}

function buildHash(name, params) {
  const pairs = Object.entries(params).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  const query = new URLSearchParams(pairs).toString();
  return `#/${name}${query ? `?${query}` : ''}`;
}

function parseHash(fallback) {
  const [name, query] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { name: name || fallback, params: Object.fromEntries(new URLSearchParams(query || '')) };
}

async function render(route, params) {
  current = route.name;
  for (const button of navNode.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.route === route.name);
  }
  applyBackground(route.name);
  setHeader(route.title, route.subtitle);
  view.dispatchEvent(new CustomEvent('view:teardown'));
  clear(view);
  view.scrollTop = 0;
  try {
    await route.render(view, params);
  } catch (error) {
    mount(
      view,
      el('div', { class: 'empty' }, el('h3', { text: t('common.crash') }), el('p', { text: error.message }))
    );
    toast(t('common.error'), error.message, { tone: 'warn' });
  }
}

export function refresh() {
  const route = routes.find((item) => item.name === current);
  if (route) render(route, {});
}

export function startRouter(fallback) {
  const resolve = () => {
    const { name, params } = parseHash(fallback);
    const route = routes.find((item) => item.name === name) || routes[0];
    render(route, params);
  };
  window.addEventListener('hashchange', resolve);
  resolve();
}
