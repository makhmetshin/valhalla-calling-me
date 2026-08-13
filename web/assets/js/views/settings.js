import { api } from '../core/api.js';
import { applyBackground } from '../core/backgrounds.js';
import { confirmDialog, el, mount } from '../core/dom.js';
import { formatBytes } from '../core/format.js';
import { formModal } from '../core/modal.js';
import { currentRoute, setHeader } from '../core/router.js';
import { loadMedia, loadPreferences, mediaOfKind, savePreferences, state } from '../core/state.js';
import {
  THEMES,
  accentOverride,
  activeTheme,
  applyAppearance,
  effectiveAccent,
  swatch,
} from '../core/themes.js';
import { playUrl } from '../core/audio.js';
import { toast } from '../core/toast.js';

const LOOK_KEYS = ['theme.palette', 'theme.accent', 'theme.font_heading', 'theme.font_body'];

const PAGES = [
  { name: 'default', title: 'По умолчанию' },
  { name: 'dashboard', title: 'Чертог' },
  { name: 'achievements', title: 'Ачивки' },
  { name: 'metrics', title: 'Метрики' },
  { name: 'tasks', title: 'Чек-лист' },
  { name: 'plan', title: 'План дня' },
  { name: 'reminders', title: 'Напоминания' },
  { name: 'codex', title: 'Кодекс' },
  { name: 'music', title: 'Музыка' },
  { name: 'settings', title: 'Настройки' },
];

export async function renderSettings(container) {
  await Promise.all([loadMedia(true), loadPreferences(true)]);
  const [vault, backups] = await Promise.all([api.vault(), api.backups()]);

  setHeader('Настройки', 'Всё лежит в папке vault — её можно унести с собой', [
    el('button', {
      class: 'btn',
      text: 'Найти новые файлы',
      onclick: async () => {
        const result = await api.scanVault();
        await loadMedia(true);
        toast('Хранилище просмотрено', `новых файлов: ${result.discovered}`);
        renderSettings(container);
      },
    }),
    el('button', {
      class: 'btn',
      text: 'Пересобрать пресеты',
      onclick: async () => {
        const result = await api.syncPresets();
        await loadMedia(true);
        toast('Пресеты обновлены', `новых файлов: ${result.discovered}`);
        renderSettings(container);
      },
    }),
    el('button', {
      class: 'btn primary',
      text: 'Сделать бэкап',
      onclick: async () => {
        const result = await api.createBackup();
        toast('Архив собран', result.name);
        renderSettings(container);
      },
    }),
  ]);

  mount(
    container,
    el('div', { class: 'section-title' }, el('span', { text: 'Звук' })),
    soundBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: 'Темы' })),
    themesBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: 'Облик' })),
    lookBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: 'Фоны страниц' })),
    backgroundsBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: 'Хранилище' })),
    vaultBlock(vault, backups, container),
    el('div', { class: 'section-title' }, el('span', { text: 'Библиотека медиа' })),
    mediaBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: 'Сброс' })),
    resetBlock()
  );
}

function field(label, control, hint) {
  return el(
    'label',
    { class: 'field' },
    el('span', { text: label }),
    control,
    hint ? el('p', { class: 'muted', style: { margin: '6px 0 0' }, text: hint }) : null
  );
}

function soundBlock(container) {
  const volume = el('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    value: state.preferences['audio.master_volume'] ?? 0.7,
    style: { width: '100%' },
  });
  volume.onchange = async () => {
    await savePreferences({ 'audio.master_volume': Number(volume.value) });
    playUrl('/presets/audio/rune-chime.wav');
  };

  const soundSelect = (key, label) => {
    const select = el(
      'select',
      {},
      [el('option', { value: '', text: '— звук по умолчанию —' })].concat(
        mediaOfKind('audio').map((asset) =>
          el('option', {
            value: String(asset.id),
            text: asset.title,
            selected: state.preferences[key] === asset.id,
          })
        )
      )
    );
    select.onchange = async () => {
      const id = select.value ? Number(select.value) : null;
      await savePreferences({ [key]: id });
      const asset = mediaOfKind('audio').find((item) => item.id === id);
      if (asset) playUrl(asset.url);
    };
    return field(
      label,
      el(
        'div',
        { class: 'audio-row' },
        select,
        el('button', {
          class: 'btn sm',
          text: '▶',
          onclick: () => {
            const asset = mediaOfKind('audio').find((item) => item.id === state.preferences[key]);
            playUrl(asset ? asset.url : '/presets/audio/victory-horns.wav');
          },
        })
      )
    );
  };

  return el(
    'div',
    { class: 'card grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } },
    field('Громкость', volume),
    soundSelect('audio.unlock_sound_id', 'Звук ачивки'),
    soundSelect('audio.reminder_sound_id', 'Звук напоминания'),
    el(
      'div',
      { style: { alignSelf: 'end' } },
      el('button', {
        class: 'btn',
        text: 'Загрузить свой звук',
        onclick: () =>
          formModal({
            title: 'Свой звук',
            fields: [{ name: 'sound', label: 'Аудио', type: 'media', kind: 'audio', value: null }],
            onSubmit: async () => {
              await loadMedia(true);
              await renderSettings(container);
            },
          }),
      })
    )
  );
}

function themesBlock(container) {
  const current = activeTheme();

  return el(
    'div',
    { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' } },
    THEMES.map((theme) =>
      el(
        'button',
        {
          class: `theme-card${theme.name === current.name ? ' on' : ''}`,
          onclick: async () => {
            await savePreferences({ 'theme.palette': theme.name, 'theme.accent': '' });
            applyAppearance();
            renderSettings(container);
          },
        },
        swatch(theme),
        el('strong', { text: theme.title }),
        el('span', { text: theme.hint })
      )
    )
  );
}

function lookBlock(container) {
  const accent = el('input', {
    type: 'color',
    value: effectiveAccent(),
    style: { width: '100%', height: '38px', padding: '2px', background: 'var(--sunken)' },
  });
  accent.onchange = async () => {
    await savePreferences({ 'theme.accent': accent.value });
    applyAppearance();
    renderSettings(container);
  };

  const fontSelect = (key, label) => {
    const fonts = mediaOfKind('font');
    const select = el(
      'select',
      {},
      [el('option', { value: '', text: '— стандартный —' })].concat(
        fonts.map((asset) =>
          el('option', {
            value: asset.url,
            text: asset.title,
            selected: state.preferences[key] === asset.url,
          })
        )
      )
    );
    select.onchange = async () => {
      await savePreferences({ [key]: select.value || '' });
      applyAppearance();
    };
    return field(label, select, 'файлы шрифтов клади в vault/fonts');
  };

  return el(
    'div',
    { class: 'card grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
    field(
      'Акцентный цвет',
      accent,
      accentOverride() ? 'свой цвет поверх темы' : `цвет темы «${activeTheme().title}»`
    ),
    fontSelect('theme.font_heading', 'Шрифт заголовков'),
    fontSelect('theme.font_body', 'Шрифт текста'),
    el(
      'div',
      { class: 'row', style: { alignSelf: 'end' } },
      el('button', {
        class: 'btn',
        text: 'Цвет темы',
        disabled: !accentOverride(),
        onclick: async () => {
          await savePreferences({ 'theme.accent': '' });
          applyAppearance();
          renderSettings(container);
        },
      }),
      el('button', {
        class: 'btn ghost',
        text: 'Сбросить облик',
        onclick: async () => {
          await api.resetPreferences(LOOK_KEYS);
          await loadPreferences(true);
          applyAppearance();
          renderSettings(container);
        },
      })
    )
  );
}

function resetBlock() {
  return el(
    'div',
    { class: 'card row between' },
    el(
      'div',
      {},
      el('div', { class: 'card-title', text: 'Вернуть настройки по умолчанию' }),
      el('p', {
        class: 'muted',
        style: { margin: '6px 0 0' },
        text: 'Тема, цвет, шрифты, фоны, громкость и звуки станут как при первом запуске. Ачивки, метрики, таски, кодекс, музыка и файлы останутся на месте.',
      })
    ),
    el('button', {
      class: 'btn danger',
      text: 'Сбросить всё',
      onclick: async () => {
        if (!confirmDialog('Вернуть все настройки к значениям по умолчанию?')) return;
        await api.resetPreferences();
        window.location.reload();
      },
    })
  );
}

function backgroundsBlock(container) {
  const backgrounds = state.preferences.backgrounds || {};

  return el(
    'div',
    { class: 'grid cards' },
    PAGES.map((page) => {
      const config = backgrounds[page.name];
      return el(
        'article',
        { class: 'card' },
        el(
          'div',
          { class: 'row between' },
          el('div', { class: 'card-title', text: page.title }),
          config ? el('span', { class: 'tag on', text: config.kind === 'video' ? 'видео' : 'картинка' }) : null
        ),
        config
          ? el('div', {
              style: {
                marginTop: '10px',
                height: '90px',
                border: '1px solid var(--line)',
                backgroundImage: config.kind === 'video' ? 'none' : `url("${config.url}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--muted)',
                fontSize: '12px',
              },
              text: config.kind === 'video' ? config.url.split('/').pop() : '',
            })
          : el('p', { class: 'muted', style: { marginTop: '10px' }, text: 'фон не задан' }),
        el(
          'div',
          { class: 'card-foot' },
          el('button', {
            class: 'btn sm',
            text: 'Задать',
            onclick: () => backgroundForm(page, config, container),
          }),
          config
            ? el('button', {
                class: 'btn sm ghost danger',
                text: 'Убрать',
                onclick: async () => {
                  const next = { ...(state.preferences.backgrounds || {}) };
                  delete next[page.name];
                  await savePreferences({ backgrounds: next });
                  applyBackground(currentRoute());
                  renderSettings(container);
                },
              })
            : null
        )
      );
    })
  );
}

function backgroundForm(page, config, container) {
  formModal({
    title: `Фон — ${page.title}`,
    subtitle: 'Картинка или видео. Видео кладётся в vault/video.',
    fields: [
      {
        name: 'kind',
        label: 'Тип',
        type: 'select',
        value: config?.kind || 'image',
        options: [
          { value: 'image', label: 'изображение' },
          { value: 'video', label: 'видео' },
        ],
      },
      { name: 'image_id', label: 'Изображение', type: 'media', kind: 'image', value: config?.kind === 'image' ? config.media_id : null },
      { name: 'video_id', label: 'Видео', type: 'media', kind: 'video', value: config?.kind === 'video' ? config.media_id : null },
      { name: 'dim', label: 'Яркость (0—1)', type: 'number', step: 0.05, value: config?.dim ?? 0.7 },
      { name: 'blur', label: 'Размытие, px', type: 'number', step: 1, value: config?.blur ?? 0 },
    ],
    onSubmit: async (values) => {
      const mediaId = values.kind === 'video' ? values.video_id : values.image_id;
      const asset = state.media.find((item) => item.id === mediaId);
      if (!asset) throw new Error('Выбери файл');
      const next = { ...(state.preferences.backgrounds || {}) };
      next[page.name] = {
        kind: values.kind,
        media_id: asset.id,
        url: asset.url,
        dim: values.dim ?? 0.7,
        blur: values.blur ?? 0,
      };
      await savePreferences({ backgrounds: next });
      applyBackground(currentRoute());
      await renderSettings(container);
    },
  });
}

function vaultBlock(vault, backups, container) {
  return el(
    'div',
    { class: 'card stack' },
    el('p', { class: 'muted', text: vault.path }),
    el(
      'div',
      { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } },
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.database_bytes) }), el('span', { text: 'база' })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.image) }), el('span', { text: 'картинки' })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.audio) }), el('span', { text: 'звук' })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.video) }), el('span', { text: 'видео' })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.disk_free_bytes) }), el('span', { text: 'свободно' }))
    ),
    backups.length
      ? el(
          'div',
          { class: 'list' },
          backups.map((backup) =>
            el(
              'div',
              { class: 'list-item' },
              el('div', { class: 'title' }, el('div', { text: backup.name }), el('small', { text: `${backup.created_at} · ${formatBytes(backup.size_bytes)}` })),
              el('button', {
                class: 'btn sm',
                text: 'Восстановить',
                onclick: async () => {
                  if (!confirmDialog('Развернуть архив поверх текущих данных? Перезапусти приложение после.')) return;
                  await api.restoreBackup(backup.name);
                  toast('Развёрнуто', 'Перезапусти приложение');
                },
              }),
              el('button', {
                class: 'btn sm ghost danger',
                text: '✕',
                onclick: async () => {
                  if (!confirmDialog(`Удалить архив ${backup.name}?`)) return;
                  await api.deleteBackup(backup.name);
                  renderSettings(container);
                },
              })
            )
          )
        )
      : el('p', { class: 'muted', text: 'Архивов пока нет' })
  );
}

function mediaBlock(container) {
  const uploads = state.media.filter((asset) => asset.origin === 'upload');
  const presets = state.media.filter((asset) => asset.origin === 'preset');

  return el(
    'div',
    { class: 'card stack' },
    el('p', { class: 'muted', text: `пресетов: ${presets.length} · своего: ${uploads.length}` }),
    uploads.length
      ? el(
          'div',
          { class: 'list' },
          uploads.map((asset) =>
            el(
              'div',
              { class: 'list-item' },
              asset.kind === 'image'
                ? el('img', { src: asset.url, alt: '', style: { width: '34px', height: '34px', objectFit: 'cover', border: '1px solid var(--line)' } })
                : null,
              el('div', { class: 'title' }, el('div', { text: asset.title }), el('small', { text: `${asset.kind} · ${formatBytes(asset.size_bytes)}` })),
              el('button', {
                class: 'btn sm ghost',
                text: 'Имя',
                onclick: () =>
                  formModal({
                    title: 'Переименовать',
                    fields: [{ name: 'title', label: 'Название', value: asset.title }],
                    onSubmit: async (values) => {
                      await api.renameMedia(asset.id, values.title);
                      await loadMedia(true);
                      await renderSettings(container);
                    },
                  }),
              }),
              el('button', {
                class: 'btn sm ghost danger',
                text: '✕',
                onclick: async () => {
                  if (!confirmDialog(`Удалить файл «${asset.title}»?`)) return;
                  try {
                    await api.deleteMedia(asset.id);
                    await loadMedia(true);
                    renderSettings(container);
                  } catch (error) {
                    toast('Не удалилось', error.message, { tone: 'warn' });
                  }
                },
              })
            )
          )
        )
      : el('p', { class: 'muted', text: 'Своих файлов ещё нет — загрузи их через любую форму с иконкой.' })
  );
}
