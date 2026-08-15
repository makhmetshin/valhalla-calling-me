import { api } from '../core/api.js';
import { applyBackground } from '../core/backgrounds.js';
import { el, mount } from '../core/dom.js';
import { formatBytes } from '../core/format.js';
import { LANGUAGES, t } from '../core/i18n.js';
import { confirmAction, formModal } from '../core/modal.js';
import { currentRoute, setHeader } from '../core/router.js';
import { loadMedia, loadPreferences, mediaOfKind, savePreferences, state } from '../core/state.js';
import {
  CUSTOM,
  THEMES,
  TOKEN_GROUPS,
  activeTheme,
  applyAppearance,
  currentPalette,
  customTheme,
  swatch,
  themeHint,
  themeTitle,
  toHex,
  toTriplet,
} from '../core/themes.js';
import { onSound, previewUrl, soundPlaying, stopSound } from '../core/audio.js';
import { musicVolume, setMusicVolume } from '../core/player.js';
import { toast } from '../core/toast.js';

const LOOK_KEYS = [
  'theme.palette',
  'theme.accent',
  'theme.custom',
  'theme.font_heading',
  'theme.font_body',
];

const PAGE_NAMES = [
  'default',
  'dashboard',
  'achievements',
  'metrics',
  'tasks',
  'plan',
  'reminders',
  'codex',
  'tablets',
  'music',
  'settings',
];

const pages = () =>
  PAGE_NAMES.map((name) => ({
    name,
    title: name === 'default' ? t('set.pageDefault') : t(`nav.${name}`),
  }));

export async function renderSettings(container) {
  await Promise.all([loadMedia(true), loadPreferences(true)]);
  const [vault, backups] = await Promise.all([api.vault(), api.backups()]);
  container.addEventListener('view:teardown', stopSound, { once: true });

  setHeader(t('nav.settings'), t('set.subtitle'), [
    el('button', {
      class: 'btn',
      text: t('set.scan'),
      onclick: async () => {
        const result = await api.scanVault();
        await loadMedia(true);
        toast(t('set.scanned'), t('set.scanResult', { files: result.discovered, tracks: result.tracks }));
        renderSettings(container);
      },
    }),
    el('button', {
      class: 'btn',
      text: t('set.rebuild'),
      onclick: async () => {
        const result = await api.syncPresets();
        await loadMedia(true);
        toast(t('set.rebuilt'), t('set.rebuildResult', { count: result.discovered }));
        renderSettings(container);
      },
    }),
    el('button', {
      class: 'btn primary',
      text: t('set.backup'),
      onclick: async () => {
        const result = await api.createBackup();
        toast(t('set.backupDone'), result.name);
        renderSettings(container);
      },
    }),
  ]);

  mount(
    container,
    el('div', { class: 'section-title' }, el('span', { text: t('set.language') })),
    languageBlock(),
    el('div', { class: 'section-title' }, el('span', { text: t('set.sound') })),
    soundBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.themes') })),
    themesBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.look') })),
    lookBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.backgrounds') })),
    backgroundsBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.storage') })),
    vaultBlock(vault, backups, container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.library') })),
    mediaBlock(container),
    el('div', { class: 'section-title' }, el('span', { text: t('set.reset') })),
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
  const soundFor = (key) =>
    mediaOfKind('audio').find((item) => item.id === state.preferences[key]) || null;

  const preview = (key) => {
    const asset = soundFor(key);
    if (!asset) {
      toast(t('set.soundMissing'), t('set.soundMissingHint'), { tone: 'warn' });
      return;
    }
    previewUrl(asset.url);
  };

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
    preview('audio.unlock_sound_id');
  };

  const music = el('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    value: musicVolume(),
    style: { width: '100%' },
  });
  music.oninput = () => setMusicVolume(Number(music.value));

  const soundSelect = (key, label) => {
    const select = el(
      'select',
      {},
      [el('option', { value: '', text: t('set.noSound') })].concat(
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
      if (asset) previewUrl(asset.url);
    };

    const button = el('button', { class: 'btn sm', text: '▶', title: t('set.previewSound') });
    const paint = () => {
      const asset = soundFor(key);
      const playing = Boolean(asset) && soundPlaying(asset.url);
      button.textContent = playing ? '■' : '▶';
      button.title = playing ? t('set.stopSound') : t('set.previewSound');
    };
    button.onclick = () => {
      const asset = soundFor(key);
      if (asset && soundPlaying(asset.url)) stopSound();
      else preview(key);
    };
    const off = onSound(paint);
    container.addEventListener('view:teardown', off, { once: true });
    paint();

    return field(label, el('div', { class: 'audio-row' }, select, button), t('set.soundHint'));
  };

  return el(
    'div',
    { class: 'card grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } },
    field(t('set.volume'), volume),
    field(t('music.volume'), music),
    soundSelect('audio.unlock_sound_id', t('set.unlockSound')),
    soundSelect('audio.reminder_sound_id', t('set.reminderSound')),
    el(
      'div',
      { class: 'row beside-fields' },
      el('button', {
        class: 'btn',
        text: t('set.uploadSound'),
        onclick: () =>
          formModal({
            title: t('set.ownSound'),
            fields: [{ name: 'sound', label: t('set.audio'), type: 'media', kind: 'audio', value: null }],
            onSubmit: async () => {
              await loadMedia(true);
              await renderSettings(container);
            },
          }),
      })
    )
  );
}

function languageBlock() {
  const current = state.preferences['ui.language'] || 'ru';
  return el(
    'div',
    { class: 'card row between' },
    el(
      'div',
      { class: 'chips' },
      LANGUAGES.map((item) =>
        el('button', {
          class: `chip${item.code === current ? ' on' : ''}`,
          text: item.title,
          onclick: async () => {
            if (item.code === current) return;
            await savePreferences({ 'ui.language': item.code });
            window.location.reload();
          },
        })
      )
    )
  );
}

function themesBlock(container) {
  const current = activeTheme();

  const pick = async (theme) => {
    const values =
      theme.name === CUSTOM
        ? { 'theme.palette': CUSTOM, 'theme.custom': theme.palette, 'theme.accent': '' }
        : { 'theme.palette': theme.name, 'theme.accent': '' };
    await savePreferences(values);
    applyAppearance();
    renderSettings(container);
  };

  return el(
    'div',
    { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' } },
    THEMES.concat([customTheme()]).map((theme) =>
      el(
        'button',
        {
          class: `theme-card${theme.name === current.name ? ' on' : ''}`,
          onclick: () => pick(theme),
        },
        swatch(theme),
        el('strong', { text: themeTitle(theme) }),
        el('span', { text: themeHint(theme) })
      )
    )
  );
}

function lookBlock(container) {
  const palette = currentPalette();

  const colourField = (token) => {
    const well = el('input', { type: 'color', class: 'color-well', value: toHex(palette[token]) });
    well.onchange = async () => {
      await savePreferences({
        'theme.palette': CUSTOM,
        'theme.custom': { ...palette, [token]: toTriplet(well.value) },
        'theme.accent': '',
      });
      applyAppearance();
      renderSettings(container);
    };
    return field(t(`token.${token}`), well);
  };

  const colourCard = (group) =>
    el(
      'div',
      { class: 'card' },
      el('div', { class: 'card-title', text: t(`set.colours.${group.name}`) }),
      el(
        'div',
        {
          class: 'grid',
          style: { gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginTop: '12px' },
        },
        group.tokens.map(colourField)
      )
    );

  const fontSelect = (key, label) => {
    const fonts = mediaOfKind('font');
    const select = el(
      'select',
      {},
      [el('option', { value: '', text: t('set.fontDefault') })].concat(
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
    return field(label, select, t('set.fontHint'));
  };

  return el(
    'div',
    { class: 'stack' },
    el(
      'div',
      { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } },
      TOKEN_GROUPS.map(colourCard)
    ),
    el(
      'div',
      { class: 'card grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
      fontSelect('theme.font_heading', t('set.fontHeading')),
      fontSelect('theme.font_body', t('set.fontBody')),
      el(
        'div',
        { class: 'row beside-fields' },
        el('button', {
          class: 'btn ghost',
          text: t('set.resetLook'),
          onclick: async () => {
            await api.resetPreferences(LOOK_KEYS);
            await loadPreferences(true);
            applyAppearance();
            renderSettings(container);
          },
        })
      )
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
      el('div', { class: 'card-title', text: t('set.resetTitle') }),
      el('p', {
        class: 'muted',
        style: { margin: '6px 0 0' },
        text: t('set.resetText'),
      })
    ),
    el('button', {
      class: 'btn danger',
      text: t('set.resetAll'),
      onclick: async () => {
        const yes = await confirmAction({
          title: t('set.resetConfirm'),
          message: t('set.resetConfirmText'),
          confirmLabel: t('set.resetAction'),
        });
        if (!yes) return;
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
    pages().map((page) => {
      const config = backgrounds[page.name];
      return el(
        'article',
        { class: 'card' },
        el(
          'div',
          { class: 'row between' },
          el('div', { class: 'card-title', text: page.title }),
          config
            ? el('span', {
                class: 'tag on',
                text: config.kind === 'video' ? t('set.kindVideo') : t('set.kindImage'),
              })
            : null
        ),
        config ? backgroundPreview(config) : el('p', { class: 'muted', style: { marginTop: '10px' }, text: t('set.noBackground') }),
        el(
          'div',
          { class: 'card-foot' },
          el('button', {
            class: 'btn sm',
            text: t('set.setBackground'),
            onclick: () => backgroundForm(page, config, container),
          }),
          config
            ? el('button', {
                class: 'btn sm ghost danger',
                text: t('set.dropBackground'),
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

function backgroundPreview(config) {
  if (config.kind === 'video') {
    return el('video', {
      class: 'background-preview',
      src: config.url,
      autoplay: true,
      loop: true,
      muted: true,
      playsInline: true,
    });
  }
  return el('div', {
    class: 'background-preview',
    style: { backgroundImage: `url("${config.url}")` },
  });
}

function backgroundForm(page, config, container) {
  formModal({
    title: t('set.backgroundFor', { page: page.title }),
    subtitle: t('set.backgroundHint'),
    fields: [
      {
        name: 'media_id',
        label: t('set.backgroundFile'),
        type: 'media',
        kind: ['image', 'video'],
        value: config?.media_id ?? null,
        help: t('set.backgroundFileHint'),
      },
      { name: 'dim', label: t('set.dim'), type: 'number', step: 0.05, value: config?.dim ?? 0.7 },
      { name: 'blur', label: t('set.blur'), type: 'number', step: 1, value: config?.blur ?? 0 },
    ],
    onSubmit: async (values) => {
      const asset = state.media.find((item) => item.id === values.media_id);
      if (!asset) throw new Error(t('set.pickFile'));
      const next = { ...(state.preferences.backgrounds || {}) };
      next[page.name] = {
        kind: asset.kind === 'video' ? 'video' : 'image',
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
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.database_bytes) }), el('span', { text: t('set.database') })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.image) }), el('span', { text: t('set.images') })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.audio) }), el('span', { text: t('set.audioSize') })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.media_bytes.video) }), el('span', { text: t('set.videoSize') })),
      el('div', { class: 'stat' }, el('b', { text: formatBytes(vault.disk_free_bytes) }), el('span', { text: t('set.free') }))
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
                text: t('set.restore'),
                onclick: async () => {
                  const yes = await confirmAction({
                    title: t('set.restoreTitle'),
                    message: t('set.restoreText'),
                    confirmLabel: t('set.restoreAction'),
                  });
                  if (!yes) return;
                  await api.restoreBackup(backup.name);
                  toast(t('set.restored'), t('set.restartHint'));
                },
              }),
              el('button', {
                class: 'btn sm ghost danger',
                text: '✕',
                onclick: async () => {
                  const yes = await confirmAction({
                    title: t('set.dropBackupTitle'),
                    message: t('set.dropBackupText', { name: backup.name }),
                  });
                  if (!yes) return;
                  await api.deleteBackup(backup.name);
                  renderSettings(container);
                },
              })
            )
          )
        )
      : el('p', { class: 'muted', text: t('set.noBackups') })
  );
}

function mediaBlock(container) {
  const uploads = state.media.filter((asset) => asset.origin === 'upload');
  const presets = state.media.filter((asset) => asset.origin === 'preset');

  return el(
    'div',
    { class: 'card stack' },
    el('p', {
      class: 'muted',
      text: t('set.libraryCount', { presets: presets.length, uploads: uploads.length }),
    }),
    el('p', { class: 'muted', text: t('set.folderHint') }),
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
                text: t('set.rename'),
                onclick: () =>
                  formModal({
                    title: t('set.renameTitle'),
                    fields: [{ name: 'title', label: t('common.title'), value: asset.title }],
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
                  const yes = await confirmAction({
                    title: t('set.dropFileTitle'),
                    message: t('set.dropFileText', { name: asset.title }),
                  });
                  if (!yes) return;
                  try {
                    await api.deleteMedia(asset.id);
                    await loadMedia(true);
                    renderSettings(container);
                  } catch (error) {
                    toast(t('set.dropFileFailed'), error.message, { tone: 'warn' });
                  }
                },
              })
            )
          )
        )
      : el('p', { class: 'muted', text: t('set.noOwnFiles') })
  );
}
