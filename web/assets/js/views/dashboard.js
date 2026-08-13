import { api } from '../core/api.js';
import { el, iconPlate, mount } from '../core/dom.js';
import { formatDate, formatDateTime, formatNumber, minutesToHuman } from '../core/format.js';
import { entityLink, openEntity } from '../core/navigation.js';
import { navigate, setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll } from '../core/toast.js';

const GREETINGS = [
  'Ветер холодный. Идём дальше.',
  'Норны уже спряли нить. Твоё дело — идти по ней.',
  'Волк идёт следом. Не оборачивайся.',
  'Море серое, вёсла на месте.',
  'Тот, кто выдержал зиму, знает цену весне.',
];

export async function renderDashboard(container) {
  await loadMedia();
  const overview = await api.overview();
  const greeting = GREETINGS[new Date().getDate() % GREETINGS.length];

  setHeader('Чертог', greeting, [
    el('button', { class: 'btn', text: 'К плану дня', onclick: () => navigate('plan') }),
    el('button', { class: 'btn primary', text: 'К ачивкам', onclick: () => navigate('achievements') }),
  ]);

  const progress = overview.achievements;
  const ratio = progress.total ? progress.unlocked / progress.total : 0;

  const stats = el(
    'div',
    { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' } },
    stat(progress.unlocked, 'ачивок взято'),
    stat(progress.locked, 'ещё впереди'),
    stat(overview.open_tasks.length, 'тасок открыто'),
    stat(overview.due_reminders, 'зовов ждёт')
  );

  const blocks = [
    el('div', { class: 'section-title' }, el('span', { text: formatDate(overview.today) })),
    stats,
    el('div', { class: 'meter', style: { marginTop: '14px' } }, el('i', { style: { width: `${ratio * 100}%` } })),
  ];

  blocks.push(el('div', { class: 'section-title' }, el('span', { text: 'План на сегодня' })));
  blocks.push(overview.plan ? planBlock(overview.plan) : noPlan());

  if (overview.metrics.length) {
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: 'Метрики' })));
    blocks.push(
      el(
        'div',
        { class: 'grid cards' },
        overview.metrics.slice(0, 6).map((metric) => metricTile(metric, container))
      )
    );
  }

  blocks.push(el('div', { class: 'section-title' }, el('span', { text: 'Открытые таски' })));
  blocks.push(
    overview.open_tasks.length
      ? el(
          'div',
          { class: 'list' },
          overview.open_tasks.slice(0, 8).map((task) =>
            el(
              'div',
              { class: 'list-item' },
              el('button', {
                class: 'checkmark',
                text: '✓',
                onclick: async (event) => {
                  event.target.classList.add('on');
                  const result = await api.setTaskState(task.id, 'done');
                  celebrateAll(result.unlocked);
                  renderDashboard(container);
                },
              }),
              el(
                'button',
                {
                  class: 'title link-row',
                  title: 'Открыть в чек-листе',
                  onclick: () => openEntity('task', task.id),
                },
                el('div', { text: task.title }),
                task.notes ? el('small', { text: task.notes }) : null
              )
            )
          )
        )
      : el('p', { class: 'muted', text: 'Ничего не висит. Редкий день.' })
  );

  if (overview.recent_unlocks.length) {
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: 'Последние победы' })));
    blocks.push(
      el(
        'div',
        { class: 'grid cards' },
        overview.recent_unlocks.map((achievement) =>
          el(
            'article',
            {
              class: 'card unlocked',
              style: { cursor: 'pointer' },
              onclick: () => openEntity('achievement', achievement.id),
            },
            el(
              'div',
              { class: 'card-head' },
              iconPlate(achievement.icon, 'sm'),
              el(
                'div',
                { style: { flex: '1', minWidth: '0' } },
                el('div', { class: 'card-title', text: achievement.title }),
                el('div', { class: 'muted', text: formatDateTime(achievement.unlocked_at) })
              )
            )
          )
        )
      )
    );
  }

  mount(container, blocks);
}

function stat(value, label) {
  return el('div', { class: 'stat' }, el('b', { text: String(value) }), el('span', { text: label }));
}

function metricTile(metric, container) {
  const ratio = metric.target ? Math.min(1, metric.value / metric.target) : null;
  return el(
    'article',
    { class: 'card' },
    el(
      'div',
      { class: 'card-head' },
      iconPlate(metric.icon, 'sm'),
      el(
        'div',
        { style: { flex: '1', minWidth: '0' } },
        el(
          'button',
          {
            class: 'card-title link-row',
            title: 'Открыть метрику',
            onclick: () => openEntity('metric', metric.id),
          },
          metric.name
        ),
        el('div', { class: 'muted', text: `${formatNumber(metric.value)} ${metric.unit}` })
      ),
      el('button', {
        class: 'btn sm primary',
        text: `+${formatNumber(metric.step)}`,
        onclick: async () => {
          const result = await api.adjustMetric(metric.id, { delta: metric.step });
          celebrateAll(result.unlocked);
          renderDashboard(container);
        },
      })
    ),
    ratio !== null ? el('div', { class: 'meter', style: { marginTop: '12px' } }, el('i', { style: { width: `${ratio * 100}%` } })) : null
  );
}

function planBlock(plan) {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

  return el(
    'div',
    { class: 'stack' },
    el(
      'div',
      { class: 'row between' },
      el('span', { class: 'muted', text: plan.title || 'без имени' }),
      el('span', { class: 'muted', text: `${minutesToHuman(plan.total_minutes)} · до ${plan.ends_at.slice(0, 5)}` })
    ),
    el(
      'div',
      { class: 'timeline' },
      plan.slots.map((slot) => {
        const from = toMinutes(slot.starts_at);
        const to = toMinutes(slot.ends_at);
        const isDone = Boolean(slot.task) && slot.task.state === 'done';
        return el(
          'div',
          {
            class: `slot${nowMinutes >= from && nowMinutes < to ? ' now' : ''}${isDone ? ' done' : ''}`,
          },
          el('time', { text: `${slot.starts_at.slice(0, 5)} — ${slot.ends_at.slice(0, 5)}` }),
          el(
            'div',
            { class: 'title', style: { flex: '1' } },
            slot.task_id ? entityLink('task', slot.task_id, slot.label) : el('div', { text: slot.label })
          ),
          el('span', { class: 'units', text: `${slot.units} ед.` })
        );
      })
    )
  );
}

function noPlan() {
  return el(
    'div',
    { class: 'empty' },
    el('h3', { text: 'План не составлен' }),
    el('p', { text: 'День без плана растворяется. Собери его из тасок.' }),
    el('button', { class: 'btn primary', style: { marginTop: '12px' }, text: 'Собрать план', onclick: () => navigate('plan') })
  );
}
