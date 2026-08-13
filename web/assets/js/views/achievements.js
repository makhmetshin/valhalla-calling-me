import { api } from '../core/api.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { formatDateTime, formatNumber } from '../core/format.js';
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
    'Ачивки',
    `${unlocked} из ${achievements.length} взято`,
    [
      el('button', {
        class: 'btn',
        text: 'Новая группа',
        onclick: () => groupForm(null, () => renderAchievements(container)),
      }),
      el('button', {
        class: 'btn primary',
        text: 'Новая ачивка',
        onclick: () => achievementForm(null, groups, metrics, () => renderAchievements(container)),
      }),
    ]
  );

  if (!achievements.length) {
    mount(
      container,
      emptyState(
        'Ни одной ачивки',
        'Придумай себе первое испытание. Даже самое малое считается.',
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: 'Создать ачивку',
          onclick: () => achievementForm(null, groups, metrics, () => renderAchievements(container)),
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
          text: 'править',
          onclick: () => groupForm(group, () => renderAchievements(container)),
        }),
        el('button', {
          class: 'btn ghost sm danger',
          text: 'удалить',
          onclick: async () => {
            const yes = await confirmAction({
              title: 'Убрать группу',
              message: `«${group.name}» исчезнет, ачивки из неё останутся без группы.`,
              confirmLabel: 'Убрать',
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
        : el('p', { class: 'muted', text: 'Пусто. Испытания ещё не назначены.' })
    );
  }

  if (orphans.length) {
    sections.push(el('div', { class: 'section-title' }, el('span', { text: 'Без группы' })));
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
            ? `взято ${formatDateTime(achievement.unlocked_at)}`
            : 'ещё не взято',
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
            text: 'Снять',
            onclick: async () => {
              await api.lockAchievement(achievement.id);
              reload();
            },
          })
        : el('button', {
            class: 'btn sm primary',
            text: 'Выполнено',
            onclick: async () => {
              const updated = await api.unlockAchievement(achievement.id);
              celebrate(updated);
              reload();
            },
          }),
      el('span', { style: { flex: '1' } }),
      el('button', {
        class: 'btn sm ghost',
        text: 'Связи',
        onclick: () => openLinks('achievement', achievement.id, achievement.title),
      }),
      el('button', {
        class: 'btn sm ghost',
        text: 'Править',
        onclick: () => achievementForm(achievement, groups, metrics, reload),
      }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        title: 'стереть ачивку',
        onclick: async () => {
          const yes = await confirmAction({
            title: 'Стереть ачивку',
            message: `«${achievement.title}» исчезнет вместе со своими связями.`,
          });
          if (!yes) return;
          await api.deleteAchievement(achievement.id);
          reload();
        },
      })
    )
  );
}

export function achievementForm(achievement, groups, metrics, onDone) {
  const editing = Boolean(achievement);
  formModal({
    title: editing ? 'Правка ачивки' : 'Новая ачивка',
    subtitle: 'Опиши испытание так, чтобы потом было понятно, что ты сделал',
    fields: [
      { name: 'title', label: 'Название', value: achievement?.title || '' },
      {
        name: 'description',
        label: 'Описание',
        type: 'textarea',
        rows: 4,
        value: achievement?.description || '',
      },
      {
        name: 'lore',
        label: 'Присказка',
        type: 'text',
        placeholder: 'строка из саги, необязательно',
        value: achievement?.lore || '',
      },
      {
        name: 'group_id',
        label: 'Группа',
        type: 'select',
        value: achievement?.group_id ?? '',
        options: [{ value: null, label: '— без группы —' }].concat(
          groups.map((group) => ({ value: group.id, label: group.name }))
        ),
      },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: achievement?.icon_id ?? null },
      {
        name: 'sound_id',
        label: 'Звук при получении',
        type: 'media',
        kind: 'audio',
        value: achievement?.sound_id ?? null,
        help: 'если не выбрать — сыграет звук по умолчанию из настроек',
      },
      {
        name: 'metric_id',
        label: 'Привязать к метрике',
        type: 'select',
        value: achievement?.metric_id ?? '',
        options: [{ value: null, label: '— без метрики —' }].concat(
          metrics.map((metric) => ({
            value: metric.id,
            label: `${metric.name} (сейчас ${formatNumber(metric.value)} ${metric.unit})`,
          }))
        ),
      },
      {
        name: 'metric_target',
        label: 'Порог метрики',
        type: 'number',
        value: achievement?.metric_target ?? '',
        help: 'ачивка откроется сама, когда метрика дойдёт до этого значения',
      },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Название обязательно');
      if (editing) await api.updateAchievement(achievement.id, values);
      else await api.createAchievement(values);
      toast('Записано', values.title);
      await onDone();
    },
  });
}

function groupForm(group, onDone) {
  formModal({
    title: group ? 'Правка группы' : 'Новая группа',
    fields: [
      { name: 'name', label: 'Название', value: group?.name || '' },
      { name: 'description', label: 'Описание', type: 'textarea', rows: 3, value: group?.description || '' },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: group?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error('Название обязательно');
      if (group) await api.updateGroup(group.id, values);
      else await api.createGroup(values);
      await onDone();
    },
  });
}
