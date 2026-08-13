import { api } from '../core/api.js';
import { confirmDialog, el, emptyState, iconPlate, mount } from '../core/dom.js';
import { CADENCE_LABELS, ENTITY_LABELS, formatDateTime, toIsoLocal } from '../core/format.js';
import { formModal } from '../core/modal.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderReminders(container) {
  await loadMedia();
  const [reminders, catalog] = await Promise.all([api.reminders(), api.linkCatalog()]);

  setHeader('Напоминания', 'Голос, который зовёт, когда ты забыл', [
    el('button', {
      class: 'btn primary',
      text: 'Новое напоминание',
      onclick: () => reminderForm(null, catalog, () => renderReminders(container)),
    }),
  ]);

  if (!reminders.length) {
    mount(
      container,
      emptyState(
        'Тишина',
        'Напоминание может звать к таске, к метрике, к ачивке или к главе кодекса.',
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: 'Создать напоминание',
          onclick: () => reminderForm(null, catalog, () => renderReminders(container)),
        })
      )
    );
    return;
  }

  mount(
    container,
    el('div', { class: 'grid cards' }, reminders.map((reminder) => card(reminder, catalog, container)))
  );
}

function card(reminder, catalog, container) {
  const reload = () => renderReminders(container);
  const target =
    reminder.target_kind && reminder.target_id
      ? (catalog[reminder.target_kind] || []).find((item) => item.id === reminder.target_id)
      : null;

  return el(
    'article',
    { class: 'card' },
    el(
      'div',
      { class: 'card-head' },
      iconPlate(reminder.icon),
      el(
        'div',
        { style: { flex: '1', minWidth: '0' } },
        el('div', { class: 'card-title', text: reminder.title }),
        el('div', { class: 'muted', text: CADENCE_LABELS[reminder.cadence] })
      ),
      el('span', { class: `tag${reminder.is_active ? ' on' : ''}`, text: reminder.is_active ? 'зовёт' : 'молчит' })
    ),
    reminder.message ? el('div', { class: 'card-body', text: reminder.message }) : null,
    target
      ? el(
          'div',
          { style: { marginTop: '12px' } },
          el('span', { class: 'link-pill' }, el('em', { text: ENTITY_LABELS[reminder.target_kind] }), el('span', { text: target.label }))
        )
      : null,
    el(
      'div',
      { class: 'card-foot' },
      el('span', { class: 'muted', text: `следующий зов ${formatDateTime(reminder.next_fire_at)}` }),
      el('span', { style: { flex: '1' } }),
      el('button', {
        class: 'btn sm ghost',
        text: reminder.is_active ? 'Заглушить' : 'Разбудить',
        onclick: async () => {
          await api.updateReminder(reminder.id, { is_active: !reminder.is_active });
          reload();
        },
      }),
      el('button', { class: 'btn sm ghost', text: 'Править', onclick: () => reminderForm(reminder, catalog, reload) }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        onclick: async () => {
          if (!confirmDialog(`Стереть «${reminder.title}»?`)) return;
          await api.deleteReminder(reminder.id);
          reload();
        },
      })
    )
  );
}

export function reminderForm(reminder, catalog, onDone) {
  const kinds = Object.keys(ENTITY_LABELS);
  const targetOptions = [{ value: '', label: '— ни к чему —' }];
  for (const kind of kinds) {
    for (const item of catalog[kind] || []) {
      targetOptions.push({ value: `${kind}:${item.id}`, label: `${ENTITY_LABELS[kind]} · ${item.label}` });
    }
  }

  formModal({
    title: reminder ? 'Правка напоминания' : 'Новое напоминание',
    fields: [
      { name: 'title', label: 'Заголовок', value: reminder?.title || '' },
      { name: 'message', label: 'Текст', type: 'textarea', rows: 3, value: reminder?.message || '' },
      {
        name: 'cadence',
        label: 'Как часто',
        type: 'select',
        value: reminder?.cadence || 'daily',
        options: Object.entries(CADENCE_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        name: 'anchor_at',
        label: 'Точка отсчёта',
        type: 'datetime-local',
        value: reminder ? toIsoLocal(new Date(reminder.anchor_at)) : toIsoLocal(new Date()),
        help: 'от неё считаются все следующие зовы',
      },
      {
        name: 'target',
        label: 'Ссылается на',
        type: 'select',
        value: reminder?.target_kind ? `${reminder.target_kind}:${reminder.target_id}` : '',
        options: targetOptions,
      },
      { name: 'sound_id', label: 'Звук', type: 'media', kind: 'audio', value: reminder?.sound_id ?? null },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: reminder?.icon_id ?? null },
      { name: 'is_active', label: 'Активно', type: 'checkbox', value: reminder ? reminder.is_active : true },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Заголовок обязателен');
      const [kind, id] = values.target ? values.target.split(':') : [null, null];
      const payload = {
        title: values.title,
        message: values.message,
        cadence: values.cadence,
        anchor_at: values.anchor_at ? `${values.anchor_at}:00` : null,
        target_kind: kind,
        target_id: id ? Number(id) : null,
        sound_id: values.sound_id,
        icon_id: values.icon_id,
        is_active: values.is_active,
      };
      if (reminder) await api.updateReminder(reminder.id, payload);
      else await api.createReminder(payload);
      toast('Зов назначен', payload.title);
      await onDone();
    },
  });
}
