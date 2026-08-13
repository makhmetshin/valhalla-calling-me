import { api } from '../core/api.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { CADENCE_KEYS, cadenceLabel, formatDateTime, toIsoLocal } from '../core/format.js';
import { t } from '../core/i18n.js';
import { confirmAction, formModal } from '../core/modal.js';
import { anchor, entityLink, focusEntity } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderReminders(container, params = {}) {
  await loadMedia();
  const [reminders, catalog] = await Promise.all([api.reminders(), api.linkCatalog()]);

  setHeader(t('nav.reminders'), t('rem.subtitle'), [
    el('button', {
      class: 'btn primary',
      text: t('rem.newOne'),
      onclick: () => reminderForm(null, catalog, () => renderReminders(container)),
    }),
  ]);

  if (!reminders.length) {
    mount(
      container,
      emptyState(
        t('rem.emptyTitle'),
        t('rem.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('rem.create'),
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
        el('div', { class: 'muted', text: cadenceLabel(reminder.cadence) })
      ),
      el('span', {
        class: `tag${reminder.is_active ? ' on' : ''}`,
        text: reminder.is_active ? t('rem.calling') : t('rem.silent'),
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
          ? t(once ? 'rem.singleCall' : 'rem.nextCall', {
              when: formatDateTime(reminder.next_fire_at),
            })
          : t('rem.lastCall', { when: formatDateTime(reminder.last_fired_at) }),
      }),
      el('span', { style: { flex: '1' } }),
      el('button', {
        class: 'btn sm ghost',
        text: reminder.is_active ? t('rem.mute') : t('rem.wake'),
        onclick: async () => {
          await api.updateReminder(reminder.id, { is_active: !reminder.is_active });
          reload();
        },
      }),
      el('button', {
        class: 'btn sm ghost',
        text: t('common.edit'),
        onclick: () => reminderForm(reminder, catalog, reload),
      }),
      el('button', {
        class: 'btn sm ghost danger',
        text: t('common.delete'),
        onclick: async () => {
          const yes = await confirmAction({
            title: t('rem.deleteTitle'),
            message: t('rem.deleteText', { name: reminder.title }),
          });
          if (!yes) return;
          await api.deleteReminder(reminder.id);
          toast(t('rem.deletedToast'), reminder.title);
          reload();
        },
      })
    )
  );
}

export function reminderForm(reminder, catalog, onDone) {
  formModal({
    title: reminder ? t('rem.formEdit') : t('rem.newOne'),
    fields: [
      { name: 'title', label: t('rem.heading'), value: reminder?.title || '' },
      { name: 'message', label: t('rem.text'), type: 'textarea', rows: 3, value: reminder?.message || '' },
      {
        name: 'cadence',
        label: t('rem.cadence'),
        type: 'select',
        value: reminder?.cadence || 'daily',
        options: CADENCE_KEYS.map((value) => ({ value, label: cadenceLabel(value) })),
      },
      {
        name: 'anchor_at',
        label: t('rem.anchor'),
        type: 'datetime-local',
        value: reminder ? toIsoLocal(new Date(reminder.anchor_at)) : toIsoLocal(new Date()),
        help: t('rem.anchorHelp'),
      },
      {
        name: 'target',
        label: t('rem.target'),
        type: 'entity',
        catalog,
        value: reminder?.target_kind
          ? { kind: reminder.target_kind, id: reminder.target_id }
          : null,
        help: t('rem.targetHelp'),
      },
      { name: 'sound_id', label: t('common.sound'), type: 'media', kind: 'audio', value: reminder?.sound_id ?? null },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: reminder?.icon_id ?? null },
      { name: 'is_active', label: t('rem.active'), type: 'checkbox', value: reminder ? reminder.is_active : true },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('rem.headingRequired'));
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
      toast(t('rem.savedToast'), payload.title);
      await onDone();
    },
  });
}
