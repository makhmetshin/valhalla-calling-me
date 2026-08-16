import { api } from '../core/api.js';
import { basisField } from '../core/basis.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { formatDateTime, formatNumber } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { closeModal, confirmAction, formModal, openModal } from '../core/modal.js';
import { anchor, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { celebrateAll, toast } from '../core/toast.js';

export async function renderMetrics(container, params = {}) {
  await loadMedia();
  const metrics = await api.metrics();

  setHeader(t('nav.metrics'), t('metric.subtitle'), [
    el('button', {
      class: 'btn primary',
      text: t('metric.newOne'),
      onclick: () => metricForm(null, () => renderMetrics(container), metrics),
    }),
  ]);

  if (!metrics.length) {
    mount(
      container,
      emptyState(
        t('metric.emptyTitle'),
        t('metric.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('metric.create'),
          onclick: () => metricForm(null, () => renderMetrics(container), metrics),
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
          text: metric.direction === 'down' ? t('metric.down') : t('metric.up'),
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
        ? el('span', { class: 'muted', style: { marginLeft: 'auto' }, text: t('metric.goal', { value: formatNumber(metric.target) }) })
        : null
    ),
    ratio !== null ? el('div', { class: 'meter', style: { marginTop: '10px' } }, el('i', { style: { width: `${ratio * 100}%` } })) : null,
    metric.description ? el('div', { class: 'card-body', text: metric.description }) : null,
    el(
      'div',
      { class: 'card-foot' },
      el('button', { class: 'btn sm', text: `−${formatNumber(metric.step)}`, onclick: () => apply(-metric.step) }),
      el('button', { class: 'btn sm primary', text: `+${formatNumber(metric.step)}`, onclick: () => apply(metric.step) }),
      el('button', { class: 'btn sm ghost', text: t('metric.set'), onclick: () => setValueForm(metric, reload) }),
      el('span', { style: { flex: '1' } }),
      el('button', { class: 'btn sm ghost', text: t('metric.history'), onclick: () => historyModal(metric) }),
      el('button', {
        class: 'btn sm ghost',
        text: t('common.links'),
        onclick: () => openLinks('metric', metric.id, metric.name),
      }),
      el('button', { class: 'btn sm ghost', text: t('common.edit'), onclick: () => metricForm(metric, reload) }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        title: t('metric.deleteHint'),
        onclick: async () => {
          const yes = await confirmAction({
            title: t('metric.deleteTitle'),
            message: t('metric.deleteText', { name: metric.name }),
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
    title: t('metric.setValue'),
    subtitle: metric.name,
    fields: [
      { name: 'value', label: t('metric.newValue'), type: 'number', value: metric.value },
      { name: 'note', label: t('metric.note'), type: 'text', value: '' },
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
    title: t('metric.history'),
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
                  el('small', { text: entry.note || t('common.dash') })
                ),
                el('span', { class: 'muted', text: formatDateTime(entry.recorded_at) })
              )
            )
          )
        : el('p', { class: 'muted', text: t('metric.noHistory') }),
    ],
    actions: [el('button', { class: 'btn ghost', text: t('common.close'), onclick: closeModal })],
  });
}

export function metricForm(metric, onDone, samples = []) {
  const editing = Boolean(metric?.id);
  formModal({
    title: editing ? t('metric.formEdit') : t('metric.newOne'),
    fields: [
      editing ? null : basisField(samples, metric?.basis, (draft) => metricForm(draft, onDone, samples)),
      { name: 'name', label: t('common.title'), value: metric?.name || '' },
      { name: 'description', label: t('common.description'), type: 'textarea', rows: 3, value: metric?.description || '' },
      { name: 'unit', label: t('metric.unit'), type: 'text', placeholder: t('metric.unitPlaceholder'), value: metric?.unit || '' },
      editing ? null : { name: 'value', label: t('metric.startValue'), type: 'number', value: 0 },
      { name: 'step', label: t('metric.step'), type: 'number', value: metric?.step ?? 1 },
      {
        name: 'direction',
        label: t('metric.direction'),
        type: 'select',
        value: metric?.direction || 'up',
        options: [
          { value: 'up', label: t('metric.directionUp') },
          { value: 'down', label: t('metric.directionDown') },
        ],
      },
      { name: 'target', label: t('metric.target'), type: 'number', value: metric?.target ?? '' },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: metric?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error(t('common.titleRequired'));
      if (editing) await api.updateMetric(metric.id, values);
      else await api.createMetric(values);
      toast(t('metric.savedToast'), values.name);
      await onDone();
    },
  });
}
