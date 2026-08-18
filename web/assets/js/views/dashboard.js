import { api } from '../core/api.js';
import { el, iconPlate, mount } from '../core/dom.js';
import { formatDate, formatDateTime, formatNumber, minutesToHuman } from '../core/format.js';
import { greetings, t } from '../core/i18n.js';
import { entityLink, openEntity } from '../core/navigation.js';
import { navigate, setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll } from '../core/toast.js';

export async function renderDashboard(container) {
  await loadMedia();
  const overview = await api.overview();
  const sayings = greetings();
  const greeting = sayings[new Date().getDate() % sayings.length];

  setHeader(t('nav.dashboard'), greeting, [
    el('button', { class: 'btn', text: t('dash.toPlan'), onclick: () => navigate('plan') }),
    el('button', { class: 'btn primary', text: t('dash.toAchievements'), onclick: () => navigate('achievements') }),
  ]);

  const progress = overview.achievements;
  const ratio = progress.total ? progress.unlocked / progress.total : 0;

  const stats = el(
    'div',
    { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' } },
    stat(progress.unlocked, t('dash.unlocked')),
    stat(progress.locked, t('dash.locked')),
    stat(overview.open_tasks.length, t('dash.openTasks')),
    stat(overview.due_reminders, t('dash.dueReminders'))
  );

  const blocks = [
    el('div', { class: 'section-title' }, el('span', { text: formatDate(overview.today) })),
    stats,
    el('div', { class: 'meter', style: { marginTop: '14px' } }, el('i', { style: { width: `${ratio * 100}%` } })),
  ];

  blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('dash.todayPlan') })));
  blocks.push(overview.plan ? planBlock(overview.plan) : noPlan());

  if (overview.metrics.length) {
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('dash.metrics') })));
    blocks.push(
      el(
        'div',
        { class: 'grid cards' },
        overview.metrics.map((metric) => metricTile(metric, container))
      )
    );
  }

  blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('dash.tasks') })));
  blocks.push(
    overview.open_tasks.length
      ? el(
          'div',
          { class: 'list' },
          overview.open_tasks.map((task) =>
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
                  title: t('dash.openInTasks'),
                  onclick: () => openEntity('task', task.id),
                },
                el('div', { text: task.title }),
                task.notes ? el('small', { text: task.notes }) : null
              )
            )
          )
        )
      : el('p', { class: 'muted', text: t('dash.noTasks') })
  );

  if (overview.recent_unlocks.length) {
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('dash.recent') })));
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
            title: t('dash.openMetric'),
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
      el('span', { class: 'muted', text: plan.title || t('common.nameless') }),
      el('span', { class: 'muted', text: t('plan.until', {
            duration: minutesToHuman(plan.total_minutes),
            time: plan.ends_at.slice(0, 5),
          }) })
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
          el('span', { class: 'units', text: `${slot.units}×` })
        );
      })
    )
  );
}

function noPlan() {
  return el(
    'div',
    { class: 'empty' },
    el('h3', { text: t('dash.noPlanTitle') }),
    el('p', { text: t('dash.noPlanHint') }),
    el('button', { class: 'btn primary', style: { marginTop: '12px' }, text: t('dash.buildPlan'), onclick: () => navigate('plan') })
  );
}
