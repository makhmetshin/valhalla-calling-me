import { el } from './dom.js';
import { entityLabel } from './format.js';
import { t } from './i18n.js';
import { navigate } from './router.js';

const ROUTE_BY_KIND = {
  achievement: 'achievements',
  achievement_group: 'achievements',
  metric: 'metrics',
  task: 'tasks',
  day_plan: 'plan',
  reminder: 'reminders',
  codex_chapter: 'codex',
  codex_entry: 'codex',
  tablet_kind: 'tablets',
  tablet_page: 'tablets',
  track: 'music',
};

const FLASH_MS = 2200;

export function routeForKind(kind) {
  return ROUTE_BY_KIND[kind] || 'dashboard';
}

export function openEntity(kind, id) {
  return navigate(routeForKind(kind), { focus: `${kind}:${id}` });
}

export function anchor(kind, id) {
  return { entity: `${kind}:${id}` };
}

export function entityLink(kind, id, label, detail) {
  return el(
    'button',
    {
      class: 'link-pill',
      title: t('common.openThing', { kind: entityLabel(kind) }),
      onclick: (event) => {
        event.stopPropagation();
        openEntity(kind, id);
      },
    },
    el('em', { text: entityLabel(kind) }),
    el('span', { text: label }),
    detail ? el('small', { text: detail }) : null
  );
}

export function focusEntity(container, params) {
  const key = params && params.focus;
  if (!key) return;
  const node = container.querySelector(`[data-entity="${key}"]`);
  if (!node) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.add('focused');
  setTimeout(() => node.classList.remove('focused'), FLASH_MS);
}

export function focusTarget(params) {
  const key = params && params.focus;
  if (!key) return null;
  const [kind, id] = key.split(':');
  return { kind, id: Number(id) };
}
