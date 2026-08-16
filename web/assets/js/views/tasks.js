import { api } from '../core/api.js';
import { basisField } from '../core/basis.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { formatNumber, taskStateLabel } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { anchor, entityLink, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll, toast } from '../core/toast.js';

export async function renderTasks(container, params = {}) {
  await loadMedia();
  const [tasks, achievements, metrics] = await Promise.all([
    api.tasks(),
    api.achievements(),
    api.metrics(),
  ]);

  const done = tasks.filter((task) => task.state === 'done');
  const live = tasks.filter((task) => task.state !== 'done' && task.state !== 'abandoned');
  const dropped = tasks.filter((task) => task.state === 'abandoned');

  setHeader(t('nav.tasks'), t('task.subtitle', { done: done.length, total: tasks.length }), [
    el('button', {
      class: 'btn primary',
      text: t('task.newOne'),
      onclick: () => taskForm(null, achievements, metrics, () => renderTasks(container), tasks),
    }),
  ]);

  if (!tasks.length) {
    mount(
      container,
      emptyState(
        t('task.emptyTitle'),
        t('task.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('task.create'),
          onclick: () => taskForm(null, achievements, metrics, () => renderTasks(container), tasks),
        })
      )
    );
    return;
  }

  const blocks = [];
  const section = (title, items) => {
    if (!items.length) return;
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: title }), el('span', { class: 'muted', text: items.length })));
    blocks.push(el('div', { class: 'list' }, items.map((task) => row(task, achievements, metrics, container))));
  };

  section(t('task.live'), live);
  section(t('task.done'), done);
  section(t('task.dropped'), dropped);
  mount(container, blocks);
  focusEntity(container, params);
}

function row(task, achievements, metrics, container) {
  const reload = () => renderTasks(container);
  const isDone = task.state === 'done';

  const toggle = async () => {
    const result = await api.setTaskState(task.id, isDone ? 'open' : 'done');
    if (!isDone) celebrateAll(result.unlocked);
    reload();
  };

  const meta = [];
  if (task.units > 1) meta.push(t('task.units', { count: task.units }));
  if (task.state === 'active') meta.push(taskStateLabel('active'));

  const bonds = [];
  const achievement = achievements.find((item) => item.id === task.achievement_id);
  if (achievement) bonds.push(entityLink('achievement', achievement.id, achievement.title));
  const metric = metrics.find((item) => item.id === task.metric_id);
  if (metric && task.metric_delta) {
    const sign = task.metric_delta > 0 ? '+' : '';
    bonds.push(
      entityLink('metric', metric.id, metric.name, `${sign}${formatNumber(task.metric_delta)}`)
    );
  }

  return el(
    'div',
    { class: `list-item${isDone ? ' done' : ''}`, dataset: anchor('task', task.id) },
    el('button', { class: `checkmark${isDone ? ' on' : ''}`, text: '✓', onclick: toggle }),
    task.icon ? iconPlate(task.icon, 'sm') : null,
    el(
      'div',
      { class: 'title' },
      el('div', { text: task.title }),
      meta.length || task.notes
        ? el('small', { text: [task.notes, meta.join(' · ')].filter(Boolean).join(' — ') })
        : null,
      bonds.length ? el('div', { class: 'chips', style: { marginTop: '6px' } }, bonds) : null
    ),
    !isDone
      ? el('button', {
          class: 'btn ghost sm',
          text: task.state === 'active' ? t('task.toRest') : t('task.toBattle'),
          onclick: async () => {
            await api.setTaskState(task.id, task.state === 'active' ? 'open' : 'active');
            reload();
          },
        })
      : null,
    el('button', {
      class: 'btn ghost sm',
      text: t('common.links'),
      onclick: () => openLinks('task', task.id, task.title),
    }),
    el('button', {
      class: 'btn ghost sm',
      text: t('common.edit'),
      onclick: () => taskForm(task, achievements, metrics, reload),
    }),
    el('button', {
      class: 'btn ghost sm danger',
      text: '✕',
      title: t('task.deleteHint'),
      onclick: async () => {
        const yes = await confirmAction({
          title: t('task.deleteTitle'),
          message: t('task.deleteText', { name: task.title }),
        });
        if (!yes) return;
        await api.deleteTask(task.id);
        reload();
      },
    })
  );
}

export function taskForm(task, achievements, metrics, onDone, samples = []) {
  const editing = Boolean(task?.id);
  formModal({
    title: editing ? t('task.formEdit') : t('task.newOne'),
    fields: [
      editing
        ? null
        : basisField(samples, task?.basis, (draft) =>
            taskForm(draft, achievements, metrics, onDone, samples)
          ),
      { name: 'title', label: t('task.what'), value: task?.title || '' },
      { name: 'notes', label: t('task.notes'), type: 'textarea', rows: 3, value: task?.notes || '' },
      {
        name: 'units',
        label: t('task.unitsLabel'),
        type: 'number',
        min: 1,
        step: 1,
        value: task?.units ?? 1,
        help: t('task.unitsHelp'),
      },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: task?.icon_id ?? null },
      {
        name: 'achievement_id',
        label: t('task.closesAchievement'),
        type: 'select',
        value: task?.achievement_id ?? '',
        options: [{ value: null, label: t('task.nothing') }].concat(
          achievements.map((item) => ({ value: item.id, label: item.title }))
        ),
      },
      {
        name: 'metric_id',
        label: t('task.movesMetric'),
        type: 'select',
        value: task?.metric_id ?? '',
        options: [{ value: null, label: t('task.nothing') }].concat(
          metrics.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))
        ),
      },
      {
        name: 'metric_delta',
        label: t('task.byHowMuch'),
        type: 'number',
        value: task?.metric_delta ?? 0,
      },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('common.titleRequired'));
      const payload = { ...values, metric_delta: values.metric_delta ?? 0, units: values.units || 1 };
      if (editing) await api.updateTask(task.id, payload);
      else await api.createTask(payload);
      toast(t('common.saved'), payload.title);
      await onDone();
    },
  });
}
