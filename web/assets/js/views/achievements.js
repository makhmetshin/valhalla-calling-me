import { api } from '../core/api.js';
import { basisField } from '../core/basis.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { byLabel, formatDateTime, formatNumber } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { anchor, entityLink, focusEntity } from '../core/navigation.js';
import { celebrate, toast } from '../core/toast.js';
import { loadMedia } from '../core/state.js';
import { setHeader } from '../core/router.js';

export async function renderAchievements(container, params = {}) {
  await loadMedia();
  const [groups, achievements, metrics] = await Promise.all([
    api.groups(),
    api.achievements(),
    api.metrics(),
  ]);

  const unlocked = achievements.filter((item) => item.unlocked).length;
  setHeader(
    t('nav.achievements'),
    t('ach.subtitle', { unlocked, total: achievements.length }),
    [
      el('button', {
        class: 'btn',
        text: t('ach.newGroup'),
        onclick: () => groupForm(null, () => renderAchievements(container)),
      }),
      el('button', {
        class: 'btn primary',
        text: t('ach.newOne'),
        onclick: () => achievementForm(null, groups, metrics, () => renderAchievements(container), achievements),
      }),
    ]
  );

  if (!achievements.length) {
    mount(
      container,
      emptyState(
        t('ach.emptyTitle'),
        t('ach.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('ach.create'),
          onclick: () => achievementForm(null, groups, metrics, () => renderAchievements(container), achievements),
        })
      )
    );
    return;
  }

  const buckets = new Map(groups.map((group) => [group.id, []]));
  const orphans = [];
  for (const achievement of achievements) {
    if (achievement.group_id && buckets.has(achievement.group_id)) {
      buckets.get(achievement.group_id).push(achievement);
    } else {
      orphans.push(achievement);
    }
  }

  const sections = [];
  for (const group of groups) {
    const items = buckets.get(group.id) || [];
    sections.push(
      el(
        'div',
        { class: 'section-title', dataset: anchor('achievement_group', group.id) },
        group.icon ? iconPlate(group.icon, 'sm') : null,
        el('span', { text: group.name }),
        el('span', { class: 'muted', text: `${items.filter((i) => i.unlocked).length}/${items.length}` }),
        el('button', {
          class: 'btn ghost sm',
          text: t('ach.groupEdit'),
          onclick: () => groupForm(group, () => renderAchievements(container)),
        }),
        el('button', {
          class: 'btn ghost sm danger',
          text: t('ach.groupDelete'),
          onclick: async () => {
            const yes = await confirmAction({
              title: t('ach.groupDropTitle'),
              message: t('ach.groupDropText', { name: group.name }),
              confirmLabel: t('common.remove'),
            });
            if (!yes) return;
            await api.deleteGroup(group.id);
            renderAchievements(container);
          },
        })
      )
    );
    sections.push(
      items.length
        ? el(
            'div',
            { class: 'grid cards' },
            items.map((item) => card(item, groups, metrics, container))
          )
        : el('p', { class: 'muted', text: t('ach.groupEmpty') })
    );
  }

  if (orphans.length) {
    sections.push(el('div', { class: 'section-title' }, el('span', { text: t('ach.noGroup') })));
    sections.push(
      el('div', { class: 'grid cards' }, orphans.map((item) => card(item, groups, metrics, container)))
    );
  }

  mount(container, sections);
  focusEntity(container, params);
}

function card(achievement, groups, metrics, container) {
  const reload = () => renderAchievements(container);
  const metric = achievement.metric;
  const target = achievement.metric_target;
  const ratio =
    metric && target ? Math.min(1, Math.max(0, metric.value / (target || 1))) : null;

  return el(
    'article',
    {
      class: `card ${achievement.unlocked ? 'unlocked' : 'locked'}`,
      dataset: anchor('achievement', achievement.id),
    },
    el(
      'div',
      { class: 'card-head' },
      iconPlate(achievement.icon),
      el(
        'div',
        { style: { flex: '1', minWidth: '0' } },
        el('div', { class: 'card-title', text: achievement.title }),
        el('div', {
          class: 'muted',
          text: achievement.unlocked
            ? t('ach.takenAt', { when: formatDateTime(achievement.unlocked_at) })
            : t('ach.notTaken'),
        })
      )
    ),
    achievement.description ? el('div', { class: 'card-body', text: achievement.description }) : null,
    achievement.lore
      ? el('div', { class: 'card-body dim', style: { fontStyle: 'italic' }, text: achievement.lore })
      : null,
    metric && target !== null && target !== undefined
      ? el(
          'div',
          { style: { marginTop: '12px' } },
          el(
            'div',
            { class: 'row between', style: { marginBottom: '6px' } },
            entityLink('metric', metric.id, metric.name),
            el('span', {
              class: 'muted',
              text: `${formatNumber(metric.value)} / ${formatNumber(target)} ${metric.unit}`,
            })
          ),
          el('div', { class: 'meter' }, el('i', { style: { width: `${(ratio || 0) * 100}%` } }))
        )
      : null,
    el(
      'div',
      { class: 'card-foot' },
      achievement.unlocked
        ? el('button', {
            class: 'btn sm ghost',
            text: t('ach.lock'),
            onclick: async () => {
              await api.lockAchievement(achievement.id);
              reload();
            },
          })
        : el('button', {
            class: 'btn sm primary',
            text: t('ach.unlock'),
            onclick: async () => {
              const updated = await api.unlockAchievement(achievement.id);
              celebrate(updated);
              reload();
            },
          }),
      el('span', { style: { flex: '1' } }),
      el('button', {
        class: 'btn sm ghost',
        text: t('common.links'),
        onclick: () => openLinks('achievement', achievement.id, achievement.title),
      }),
      el('button', {
        class: 'btn sm ghost',
        text: t('common.edit'),
        onclick: () => achievementForm(achievement, groups, metrics, reload),
      }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        title: t('ach.deleteHint'),
        onclick: async () => {
          const yes = await confirmAction({
            title: t('ach.deleteTitle'),
            message: t('ach.deleteText', { name: achievement.title }),
          });
          if (!yes) return;
          await api.deleteAchievement(achievement.id);
          reload();
        },
      })
    )
  );
}

export function achievementForm(achievement, groups, metrics, onDone, samples = []) {
  const editing = Boolean(achievement?.id);
  formModal({
    title: editing ? t('ach.formEdit') : t('ach.newOne'),
    subtitle: t('ach.formSubtitle'),
    fields: [
      editing
        ? null
        : basisField(samples, achievement?.basis, (draft) =>
            achievementForm(draft, groups, metrics, onDone, samples)
          ),
      { name: 'title', label: t('common.title'), value: achievement?.title || '' },
      {
        name: 'description',
        label: t('common.description'),
        type: 'textarea',
        rows: 4,
        value: achievement?.description || '',
      },
      {
        name: 'lore',
        label: t('ach.lore'),
        type: 'text',
        placeholder: t('ach.lorePlaceholder'),
        value: achievement?.lore || '',
      },
      {
        name: 'group_id',
        label: t('ach.group'),
        type: 'select',
        value: achievement?.group_id ?? '',
        options: [{ value: null, label: t('ach.noGroupOption') }].concat(
          byLabel(groups.map((group) => ({ value: group.id, label: group.name })))
        ),
      },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: achievement?.icon_id ?? null },
      {
        name: 'sound_id',
        label: t('ach.unlockSound'),
        type: 'media',
        kind: 'audio',
        value: achievement?.sound_id ?? null,
        help: t('ach.unlockSoundHelp'),
      },
      {
        name: 'metric_id',
        label: t('ach.bindMetric'),
        type: 'select',
        value: achievement?.metric_id ?? '',
        options: [{ value: null, label: t('ach.noMetricOption') }].concat(
          byLabel(
            metrics.map((metric) => ({
              value: metric.id,
              label: t('ach.metricNow', {
                name: metric.name,
                value: formatNumber(metric.value),
                unit: metric.unit,
              }),
            }))
          )
        ),
      },
      {
        name: 'metric_target',
        label: t('ach.metricTarget'),
        type: 'number',
        value: achievement?.metric_target ?? '',
        help: t('ach.metricTargetHelp'),
      },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('common.titleRequired'));
      if (editing) await api.updateAchievement(achievement.id, values);
      else await api.createAchievement(values);
      toast(t('common.saved'), values.title);
      await onDone();
    },
  });
}

function groupForm(group, onDone) {
  formModal({
    title: group ? t('ach.groupForm') : t('ach.newGroup'),
    fields: [
      { name: 'name', label: t('common.title'), value: group?.name || '' },
      { name: 'description', label: t('common.description'), type: 'textarea', rows: 3, value: group?.description || '' },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: group?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error(t('common.titleRequired'));
      if (group) await api.updateGroup(group.id, values);
      else await api.createGroup(values);
      await onDone();
    },
  });
}
