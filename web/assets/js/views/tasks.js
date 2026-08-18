import { api } from '../core/api.js';
import { basisField } from '../core/basis.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { byLabel, formatNumber, taskStateLabel } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { anchor, entityLink, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll, toast } from '../core/toast.js';

const STATE_BUCKETS = [
  { title: 'task.live', holds: (task) => task.state === 'open' || task.state === 'active' },
  { title: 'task.done', holds: (task) => task.state === 'done' },
  { title: 'task.dropped', holds: (task) => task.state === 'abandoned' },
];

export async function renderTasks(container, params = {}) {
  await loadMedia();
  const [groups, tasks, achievements, metrics] = await Promise.all([
    api.taskGroups(),
    api.tasks(),
    api.achievements(),
    api.metrics(),
  ]);

  const context = { groups, achievements, metrics, container };
  const reload = () => renderTasks(container);
  const done = tasks.filter((task) => task.state === 'done');

  setHeader(t('nav.tasks'), t('task.subtitle', { done: done.length, total: tasks.length }), [
    el('button', { class: 'btn', text: t('task.newGroup'), onclick: () => groupForm(null, reload) }),
    el('button', {
      class: 'btn primary',
      text: t('task.newOne'),
      onclick: () => taskForm(null, context, reload, tasks),
    }),
  ]);

  if (!tasks.length && !groups.length) {
    mount(
      container,
      emptyState(
        t('task.emptyTitle'),
        t('task.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('task.create'),
          onclick: () => taskForm(null, context, reload, tasks),
        })
      )
    );
    return;
  }

  mount(container, groups.length ? grouped(groups, tasks, context) : byState(tasks, context, false));
  focusEntity(container, params);
}

function byState(tasks, context, nested) {
  const blocks = [];
  for (const bucket of STATE_BUCKETS) {
    const items = tasks.filter(bucket.holds);
    if (!items.length) continue;
    blocks.push(
      el(
        'div',
        { class: nested ? 'section-title sub' : 'section-title' },
        el('span', { text: t(bucket.title) }),
        el('span', { class: 'muted', text: items.length })
      )
    );
    blocks.push(el('div', { class: 'list' }, items.map((task) => row(task, context))));
  }
  return blocks;
}

function grouped(groups, tasks, context) {
  const blocks = [];
  for (const group of groups) {
    const items = tasks.filter((task) => task.group_id === group.id);
    blocks.push(groupTitle(group, items, context));
    blocks.push(
      items.length ? byState(items, context, true) : el('p', { class: 'muted', text: t('task.groupEmpty') })
    );
  }

  const known = new Set(groups.map((group) => group.id));
  const loose = tasks.filter((task) => !known.has(task.group_id));
  if (loose.length) {
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('task.noGroup') })));
    blocks.push(byState(loose, context, true));
  }
  return blocks;
}

function groupTitle(group, items, context) {
  const reload = () => renderTasks(context.container);
  const done = items.filter((task) => task.state === 'done').length;

  return el(
    'div',
    { class: 'section-title', dataset: anchor('task_group', group.id) },
    group.icon ? iconPlate(group.icon, 'sm') : null,
    el('span', { text: group.name }),
    el('span', { class: 'muted', text: `${done}/${items.length}` }),
    el('button', {
      class: 'btn ghost sm',
      text: t('task.groupEdit'),
      onclick: () => groupForm(group, reload),
    }),
    el('button', {
      class: 'btn ghost sm danger',
      text: t('task.groupDelete'),
      onclick: async () => {
        const yes = await confirmAction({
          title: t('task.groupDropTitle'),
          message: t('task.groupDropText', { name: group.name }),
          confirmLabel: t('common.remove'),
        });
        if (!yes) return;
        await api.deleteTaskGroup(group.id);
        reload();
      },
    })
  );
}

function row(task, context) {
  const reload = () => renderTasks(context.container);
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
  const achievement = context.achievements.find((item) => item.id === task.achievement_id);
  if (achievement) bonds.push(entityLink('achievement', achievement.id, achievement.title));
  const metric = context.metrics.find((item) => item.id === task.metric_id);
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
      onclick: () => taskForm(task, context, reload),
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

export function taskForm(task, context, onDone, samples = []) {
  const editing = Boolean(task?.id);
  formModal({
    title: editing ? t('task.formEdit') : t('task.newOne'),
    fields: [
      editing
        ? null
        : basisField(samples, task?.basis, (draft) => taskForm(draft, context, onDone, samples)),
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
      {
        name: 'group_id',
        label: t('task.group'),
        type: 'select',
        value: task?.group_id ?? '',
        options: [{ value: null, label: t('task.noGroupOption') }].concat(
          byLabel(context.groups.map((group) => ({ value: group.id, label: group.name })))
        ),
      },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: task?.icon_id ?? null },
      {
        name: 'achievement_id',
        label: t('task.closesAchievement'),
        type: 'select',
        value: task?.achievement_id ?? '',
        options: [{ value: null, label: t('task.nothing') }].concat(
          byLabel(context.achievements.map((item) => ({ value: item.id, label: item.title })))
        ),
      },
      {
        name: 'metric_id',
        label: t('task.movesMetric'),
        type: 'select',
        value: task?.metric_id ?? '',
        options: [{ value: null, label: t('task.nothing') }].concat(
          byLabel(
            context.metrics.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))
          )
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

function groupForm(group, onDone) {
  formModal({
    title: group ? t('task.groupForm') : t('task.newGroup'),
    fields: [
      { name: 'name', label: t('common.title'), value: group?.name || '' },
      {
        name: 'description',
        label: t('common.description'),
        type: 'textarea',
        rows: 3,
        value: group?.description || '',
      },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: group?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error(t('common.titleRequired'));
      if (group) await api.updateTaskGroup(group.id, values);
      else await api.createTaskGroup(values);
      await onDone();
    },
  });
}
