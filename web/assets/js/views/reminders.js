import { api } from '../core/api.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { CADENCE_LABELS, formatDateTime, toIsoLocal } from '../core/format.js';
import { confirmAction, formModal } from '../core/modal.js';
import { anchor, entityLink, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderReminders(container, params = {}) {
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
  focusEntity(container, params);
}

function card(reminder, catalog, container) {
  const reload = () => renderReminders(container);
  const target =
    reminder.target_kind && reminder.target_id
      ? (catalog[reminder.target_kind] || []).find((item) => item.id === reminder.target_id)
      : null;
  const once = reminder.cadence === 'once';

  return el(
    'article',
    { class: 'card', dataset: anchor('reminder', reminder.id) },
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
      el('span', {
        class: `tag${reminder.is_active ? ' on' : ''}`,
        text: reminder.is_active ? 'зовёт' : 'молчит',
      })
    ),
    reminder.message ? el('div', { class: 'card-body', text: reminder.message }) : null,
    target
      ? el(
          'div',
          { style: { marginTop: '12px' } },
          entityLink(reminder.target_kind, reminder.target_id, target.label, target.detail)
        )
      : null,
    el(
      'div',
      { class: 'card-foot' },
      el('span', {
        class: 'muted',
        text: reminder.is_active
          ? `${once ? 'зов' : 'следующий зов'} ${formatDateTime(reminder.next_fire_at)}`
          : `звал ${formatDateTime(reminder.last_fired_at)}`,
      }),
      el('span', { style: { flex: '1' } }),
      el('button', {
        class: 'btn sm ghost',
        text: reminder.is_active ? 'Заглушить' : 'Разбудить',
        onclick: async () => {
          await api.updateReminder(reminder.id, { is_active: !reminder.is_active });
          reload();
        },
      }),
      el('button', {
        class: 'btn sm ghost',
        text: 'Править',
        onclick: () => reminderForm(reminder, catalog, reload),
      }),
      el('button', {
        class: 'btn sm ghost danger',
        text: 'Стереть',
        onclick: async () => {
          const yes = await confirmAction({
            title: 'Стереть напоминание',
            message: `«${reminder.title}» больше не позовёт.`,
          });
          if (!yes) return;
          await api.deleteReminder(reminder.id);
          toast('Зов умолк', reminder.title);
          reload();
        },
      })
    )
  );
}

export function reminderForm(reminder, catalog, onDone) {
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
        help: 'для разового — время самого зова, для остальных — от неё считаются все следующие',
      },
      {
        name: 'target',
        label: 'Ссылается на',
        type: 'entity',
        catalog,
        value: reminder?.target_kind
          ? { kind: reminder.target_kind, id: reminder.target_id }
          : null,
        help: 'сначала выбери вид, потом сам объект',
      },
      { name: 'sound_id', label: 'Звук', type: 'media', kind: 'audio', value: reminder?.sound_id ?? null },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: reminder?.icon_id ?? null },
      { name: 'is_active', label: 'Активно', type: 'checkbox', value: reminder ? reminder.is_active : true },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Заголовок обязателен');
      const payload = {
        title: values.title,
        message: values.message,
        cadence: values.cadence,
        anchor_at: values.anchor_at ? `${values.anchor_at}:00` : null,
        target_kind: values.target ? values.target.kind : null,
        target_id: values.target ? values.target.id : null,
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
