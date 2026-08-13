import { api } from '../core/api.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { formatDateTime, formatNumber } from '../core/format.js';
import { openLinks } from '../core/links-ui.js';
import { closeModal, confirmAction, formModal, openModal } from '../core/modal.js';
import { anchor, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll, toast } from '../core/toast.js';

export async function renderMetrics(container, params = {}) {
  await loadMedia();
  const metrics = await api.metrics();

  setHeader('Метрики', 'Счётчики, по которым видно, что ты двигаешься', [
    el('button', {
      class: 'btn primary',
      text: 'Новая метрика',
      onclick: () => metricForm(null, () => renderMetrics(container)),
    }),
  ]);

  if (!metrics.length) {
    mount(
      container,
      emptyState(
        'Счётчиков нет',
        'Метрика — это то, что можно посчитать: дни, подходы, страницы, выходы из дома.',
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: 'Создать метрику',
          onclick: () => metricForm(null, () => renderMetrics(container)),
        })
      )
    );
    return;
  }

  mount(
    container,
    el('div', { class: 'grid cards' }, metrics.map((metric) => card(metric, container)))
  );
  focusEntity(container, params);
}

function card(metric, container) {
  const reload = () => renderMetrics(container);
  const ratio = metric.target ? Math.min(1, Math.max(0, metric.value / metric.target)) : null;

  const apply = async (delta) => {
    const result = await api.adjustMetric(metric.id, { delta });
    celebrateAll(result.unlocked);
    reload();
  };

  return el(
    'article',
    { class: 'card', dataset: anchor('metric', metric.id) },
    el(
      'div',
      { class: 'card-head' },
      iconPlate(metric.icon),
      el(
        'div',
        { style: { flex: '1', minWidth: '0' } },
        el('div', { class: 'card-title', text: metric.name }),
        el('div', {
          class: 'muted',
          text: metric.direction === 'down' ? 'чем меньше, тем лучше' : 'чем больше, тем лучше',
        })
      )
    ),
    el(
      'div',
      { class: 'row', style: { marginTop: '14px', alignItems: 'baseline', gap: '8px' } },
      el('b', {
        style: {
          fontFamily: 'var(--font-head)',
          fontSize: '32px',
          color: 'var(--ink-strong)',
        },
        text: formatNumber(metric.value),
      }),
      el('span', { class: 'muted', text: metric.unit }),
      metric.target !== null && metric.target !== undefined
        ? el('span', { class: 'muted', style: { marginLeft: 'auto' }, text: `цель ${formatNumber(metric.target)}` })
        : null
    ),
    ratio !== null ? el('div', { class: 'meter', style: { marginTop: '10px' } }, el('i', { style: { width: `${ratio * 100}%` } })) : null,
    metric.description ? el('div', { class: 'card-body', text: metric.description }) : null,
    el(
      'div',
      { class: 'card-foot' },
      el('button', { class: 'btn sm', text: `−${formatNumber(metric.step)}`, onclick: () => apply(-metric.step) }),
      el('button', { class: 'btn sm primary', text: `+${formatNumber(metric.step)}`, onclick: () => apply(metric.step) }),
      el('button', { class: 'btn sm ghost', text: 'Задать', onclick: () => setValueForm(metric, reload) }),
      el('span', { style: { flex: '1' } }),
      el('button', { class: 'btn sm ghost', text: 'Хроника', onclick: () => historyModal(metric) }),
      el('button', {
        class: 'btn sm ghost',
        text: 'Связи',
        onclick: () => openLinks('metric', metric.id, metric.name),
      }),
      el('button', { class: 'btn sm ghost', text: 'Править', onclick: () => metricForm(metric, reload) }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        title: 'стереть метрику',
        onclick: async () => {
          const yes = await confirmAction({
            title: 'Стереть метрику',
            message: `«${metric.name}» исчезнет вместе со своей хроникой.`,
          });
          if (!yes) return;
          await api.deleteMetric(metric.id);
          reload();
        },
      })
    )
  );
}

function setValueForm(metric, onDone) {
  formModal({
    title: 'Задать значение',
    subtitle: metric.name,
    fields: [
      { name: 'value', label: 'Новое значение', type: 'number', value: metric.value },
      { name: 'note', label: 'Пометка', type: 'text', value: '' },
    ],
    onSubmit: async (values) => {
      const result = await api.adjustMetric(metric.id, { value: values.value, note: values.note });
      celebrateAll(result.unlocked);
      await onDone();
    },
  });
}

async function historyModal(metric) {
  const entries = await api.metricHistory(metric.id);
  openModal({
    title: 'Хроника',
    subtitle: metric.name,
    content: [
      entries.length
        ? el(
            'div',
            { class: 'list' },
            entries.map((entry) =>
              el(
                'div',
                { class: 'list-item' },
                el(
                  'div',
                  { class: 'title' },
                  el('div', {
                    text: `${entry.delta >= 0 ? '+' : ''}${formatNumber(entry.delta)} → ${formatNumber(entry.value_after)}`,
                  }),
                  el('small', { text: entry.note || '—' })
                ),
                el('span', { class: 'muted', text: formatDateTime(entry.recorded_at) })
              )
            )
          )
        : el('p', { class: 'muted', text: 'Записей нет' }),
    ],
    actions: [el('button', { class: 'btn ghost', text: 'Закрыть', onclick: closeModal })],
  });
}

export function metricForm(metric, onDone) {
  formModal({
    title: metric ? 'Правка метрики' : 'Новая метрика',
    fields: [
      { name: 'name', label: 'Название', value: metric?.name || '' },
      { name: 'description', label: 'Описание', type: 'textarea', rows: 3, value: metric?.description || '' },
      { name: 'unit', label: 'Единица', type: 'text', placeholder: 'дн., раз, км', value: metric?.unit || '' },
      !metric ? { name: 'value', label: 'Начальное значение', type: 'number', value: 0 } : null,
      { name: 'step', label: 'Шаг кнопки', type: 'number', value: metric?.step ?? 1 },
      {
        name: 'direction',
        label: 'Направление',
        type: 'select',
        value: metric?.direction || 'up',
        options: [
          { value: 'up', label: 'вверх — растёт' },
          { value: 'down', label: 'вниз — падает' },
        ],
      },
      { name: 'target', label: 'Цель', type: 'number', value: metric?.target ?? '' },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: metric?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error('Название обязательно');
      if (metric) await api.updateMetric(metric.id, values);
      else await api.createMetric(values);
      toast('Метрика записана', values.name);
      await onDone();
    },
  });
}
