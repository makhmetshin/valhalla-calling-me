import { api } from '../core/api.js';
import { confirmDialog, el, emptyState, iconPlate, mount } from '../core/dom.js';
import { TASK_STATES, formatNumber } from '../core/format.js';
import { openLinks } from '../core/links-ui.js';
import { formModal } from '../core/modal.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { playUrl, FALLBACK_TASK } from '../core/audio.js';
import { celebrateAll, toast } from '../core/toast.js';

export async function renderTasks(container) {
  await loadMedia();
  const [tasks, achievements, metrics] = await Promise.all([
    api.tasks(),
    api.achievements(),
    api.metrics(),
  ]);

  const done = tasks.filter((task) => task.state === 'done');
  const live = tasks.filter((task) => task.state !== 'done' && task.state !== 'abandoned');
  const dropped = tasks.filter((task) => task.state === 'abandoned');

  setHeader('Чек-лист', `${done.length} из ${tasks.length} закрыто`, [
    el('button', {
      class: 'btn primary',
      text: 'Новая таска',
      onclick: () => taskForm(null, achievements, metrics, () => renderTasks(container)),
    }),
  ]);

  if (!tasks.length) {
    mount(
      container,
      emptyState(
        'Чек-лист пуст',
        'Мелкая задача, которую нельзя провалить, — лучшее начало дня.',
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: 'Добавить таску',
          onclick: () => taskForm(null, achievements, metrics, () => renderTasks(container)),
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

  section('В работе', live);
  section('Исполнено', done);
  section('Оставлено', dropped);
  mount(container, blocks);
}

function row(task, achievements, metrics, container) {
  const reload = () => renderTasks(container);
  const isDone = task.state === 'done';

  const toggle = async () => {
    const result = await api.setTaskState(task.id, isDone ? 'open' : 'done');
    if (!isDone) {
      playUrl(FALLBACK_TASK);
      celebrateAll(result.unlocked);
    }
    reload();
  };

  const meta = [];
  if (task.units > 1) meta.push(`${task.units} ед. времени`);
  if (task.achievement_id) {
    const achievement = achievements.find((item) => item.id === task.achievement_id);
    if (achievement) meta.push(`ачивка: ${achievement.title}`);
  }
  if (task.metric_id && task.metric_delta) {
    const metric = metrics.find((item) => item.id === task.metric_id);
    if (metric) meta.push(`${metric.name} ${task.metric_delta > 0 ? '+' : ''}${formatNumber(task.metric_delta)}`);
  }
  if (task.state === 'active') meta.push(TASK_STATES.active);

  return el(
    'div',
    { class: `list-item${isDone ? ' done' : ''}` },
    el('button', { class: `checkmark${isDone ? ' on' : ''}`, text: '✓', onclick: toggle }),
    task.icon ? iconPlate(task.icon, 'sm') : null,
    el(
      'div',
      { class: 'title' },
      el('div', { text: task.title }),
      meta.length || task.notes ? el('small', { text: [task.notes, meta.join(' · ')].filter(Boolean).join(' — ') }) : null
    ),
    !isDone
      ? el('button', {
          class: 'btn ghost sm',
          text: task.state === 'active' ? 'В покой' : 'В бой',
          onclick: async () => {
            await api.setTaskState(task.id, task.state === 'active' ? 'open' : 'active');
            reload();
          },
        })
      : null,
    el('button', {
      class: 'btn ghost sm',
      text: 'Связи',
      onclick: () => openLinks('task', task.id, task.title),
    }),
    el('button', {
      class: 'btn ghost sm',
      text: 'Править',
      onclick: () => taskForm(task, achievements, metrics, reload),
    }),
    el('button', {
      class: 'btn ghost sm danger',
      text: '✕',
      onclick: async () => {
        if (!confirmDialog(`Стереть «${task.title}»?`)) return;
        await api.deleteTask(task.id);
        reload();
      },
    })
  );
}

export function taskForm(task, achievements, metrics, onDone) {
  formModal({
    title: task ? 'Правка таски' : 'Новая таска',
    fields: [
      { name: 'title', label: 'Что сделать', value: task?.title || '' },
      { name: 'notes', label: 'Пометки', type: 'textarea', rows: 3, value: task?.notes || '' },
      {
        name: 'units',
        label: 'Единиц времени',
        type: 'number',
        min: 1,
        step: 1,
        value: task?.units ?? 1,
        help: 'сколько блоков займёт в плане дня',
      },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: task?.icon_id ?? null },
      {
        name: 'achievement_id',
        label: 'Закрывает ачивку',
        type: 'select',
        value: task?.achievement_id ?? '',
        options: [{ value: null, label: '— нет —' }].concat(
          achievements.map((item) => ({ value: item.id, label: item.title }))
        ),
      },
      {
        name: 'metric_id',
        label: 'Двигает метрику',
        type: 'select',
        value: task?.metric_id ?? '',
        options: [{ value: null, label: '— нет —' }].concat(
          metrics.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))
        ),
      },
      {
        name: 'metric_delta',
        label: 'На сколько',
        type: 'number',
        value: task?.metric_delta ?? 0,
      },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Название обязательно');
      const payload = { ...values, metric_delta: values.metric_delta ?? 0, units: values.units || 1 };
      if (task) await api.updateTask(task.id, payload);
      else await api.createTask(payload);
      toast('Записано', payload.title);
      await onDone();
    },
  });
}
