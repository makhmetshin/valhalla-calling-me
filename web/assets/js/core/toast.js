import { el, iconPlate, mount } from './dom.js';
import { playUnlock } from './audio.js';

const stack = document.getElementById('toasts');
const rite = document.getElementById('rite');
const queue = [];
let riteBusy = false;

export function toast(title, message, options = {}) {
  const node = el(
    'div',
    { class: `toast${options.tone ? ` ${options.tone}` : ''}` },
    options.icon ? iconPlate(options.icon, 'sm') : null,
    el(
      'div',
      { style: { flex: '1' } },
      el('strong', { text: title }),
      message ? el('p', { text: message }) : null,
      options.actions && options.actions.length
        ? el(
            'div',
            { class: 'toast-actions' },
            options.actions.map((action) =>
              el('button', {
                class: 'btn sm',
                text: action.label,
                onclick: () => {
                  action.run();
                  node.remove();
                },
              })
            )
          )
        : null
    )
  );

  stack.append(node);
  if (options.sticky !== true) {
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity 300ms ease';
      setTimeout(() => node.remove(), 320);
    }, options.duration || 4200);
  }
  return node;
}

export function celebrate(achievement) {
  queue.push(achievement);
  if (!riteBusy) drain();
}

function drain() {
  const achievement = queue.shift();
  if (!achievement) {
    riteBusy = false;
    return;
  }
  riteBusy = true;
  playUnlock(achievement);

  mount(
    rite,
    el('div', { class: 'rite-rays' }),
    el(
      'div',
      { class: 'rite-inner' },
      iconPlate(achievement.icon),
      el('h2', { text: 'Достижение открыто' }),
      el('h1', { text: achievement.title }),
      achievement.description ? el('p', { text: achievement.description }) : null,
      el('p', {
        class: 'muted',
        style: { marginTop: '26px' },
        text: 'нажми, чтобы продолжить путь',
      })
    )
  );
  rite.classList.add('open');

  const close = () => {
    rite.removeEventListener('click', close);
    clearTimeout(timer);
    rite.classList.remove('open');
    setTimeout(drain, 260);
  };
  const timer = setTimeout(close, 5200);
  rite.addEventListener('click', close);
}

export function celebrateAll(achievements) {
  for (const achievement of achievements || []) celebrate(achievement);
}
