import { api } from '../core/api.js';
import { el, emptyState, mount } from '../core/dom.js';
import { formatBytes, formatDateTime } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { closeModal, formModal, openModal } from '../core/modal.js';
import { anchor, focusEntity } from '../core/navigation.js';
import {
  currentTrack,
  isPlaying,
  musicVolume,
  playTrack,
  playlist,
  refreshPlaylist,
  setMusicVolume,
  toggle,
} from '../core/player.js';
import { setHeader } from '../core/router.js';
import { loadMedia, mediaOfKind, on } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderMusic(container, params = {}) {
  container.dispatchEvent(new CustomEvent('view:teardown'));
  await Promise.all([loadMedia(), refreshPlaylist()]);
  const tracks = playlist();
  const reload = () => renderMusic(container);

  setHeader(t('nav.music'), t('music.subtitle', { count: tracks.length }), [
    el('button', { class: 'btn', text: t('music.fromLibrary'), onclick: () => libraryModal(reload) }),
    el('button', { class: 'btn primary', text: t('music.upload'), onclick: () => upload(reload) }),
  ]);

  if (!tracks.length) {
    mount(
      container,
      volumeBlock(),
      emptyState(
        t('music.emptyTitle'),
        t('music.emptyHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('music.uploadMusic'),
          onclick: () => upload(reload),
        })
      )
    );
    return;
  }

  const list = el('div', { class: 'list' });
  const paint = () => mount(list, tracks.map((track, index) => row(track, index, tracks, reload)));
  paint();

  const off = on('player', paint);
  container.addEventListener('view:teardown', off, { once: true });

  mount(container, volumeBlock(), list);
  focusEntity(container, params);
}

function volumeBlock() {
  const slider = el('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    value: musicVolume(),
    style: { width: '100%' },
  });
  slider.oninput = () => setMusicVolume(Number(slider.value));

  return el(
    'div',
    { class: 'card', style: { marginBottom: '16px' } },
    el(
      'label',
      { class: 'field' },
      el('span', { text: t('music.volume') }),
      slider,
      el('p', {
        class: 'muted',
        style: { margin: '6px 0 0' },
        text: t('music.volumeHint'),
      })
    )
  );
}

function row(track, index, tracks, reload) {
  const active = currentTrack();
  const isCurrent = Boolean(active) && active.id === track.id;
  const playing = isCurrent && isPlaying();

  const meta = [
    track.play_count ? t('music.played', { count: track.play_count }) : t('music.neverPlayed'),
    track.last_played_at ? formatDateTime(track.last_played_at) : null,
    formatBytes(track.asset.size_bytes),
  ].filter(Boolean);

  const move = async (delta) => {
    const target = index + delta;
    if (target < 0 || target >= tracks.length) return;
    const ids = tracks.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.reorderTracks(ids);
    await reload();
  };

  return el(
    'div',
    { class: `list-item${isCurrent ? ' now' : ''}`, dataset: anchor('track', track.id) },
    el('button', {
      class: `player-btn${playing ? ' main' : ''}`,
      title: playing ? t('music.pause') : t('music.play'),
      text: playing ? '❚❚' : '▶',
      onclick: () => (isCurrent ? toggle() : playTrack(track.id)),
    }),
    el(
      'div',
      { class: 'title' },
      el('div', { text: track.title }),
      el('small', { text: [track.artist, meta.join(' · ')].filter(Boolean).join(' — ') })
    ),
    el('button', { class: 'btn sm ghost', text: '↑', onclick: () => move(-1) }),
    el('button', { class: 'btn sm ghost', text: '↓', onclick: () => move(1) }),
    el('button', {
      class: 'btn sm ghost',
      text: t('common.links'),
      onclick: () => openLinks('track', track.id, track.title),
    }),
    el('button', { class: 'btn sm ghost', text: t('common.edit'), onclick: () => trackForm(track, reload) }),
    el('button', { class: 'btn sm ghost danger', text: '✕', onclick: () => removeTrack(track, reload) })
  );
}

function trackForm(track, onDone) {
  formModal({
    title: t('music.trackForm'),
    fields: [
      { name: 'title', label: t('common.title'), value: track.title },
      { name: 'artist', label: t('music.artist'), value: track.artist },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('common.titleRequired'));
      await api.updateTrack(track.id, values);
      await onDone();
    },
  });
}

function removeTrack(track, onDone) {
  const drop = async (withFile) => {
    closeModal();
    try {
      await api.deleteTrack(track.id, withFile);
      await onDone();
    } catch (error) {
      toast(t('music.removeFailed'), error.message, { tone: 'warn' });
    }
  };

  openModal({
    title: t('music.removeTitle'),
    subtitle: track.title,
    content: [
      el('p', {
        class: 'muted',
        text: t('music.removeHint'),
      }),
    ],
    actions: [
      el('button', { class: 'btn ghost', text: t('common.cancel'), onclick: closeModal }),
      el('button', { class: 'btn ghost danger', text: t('music.removeWithFile'), onclick: () => drop(true) }),
      el('button', { class: 'btn primary', text: t('music.removeFromList'), onclick: () => drop(false) }),
    ],
  });
}

function upload(onDone) {
  const input = el('input', { type: 'file', accept: 'audio/*', multiple: true });
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        await api.uploadTrack(file, file.name.replace(/\.[^.]+$/, ''));
        added += 1;
      } catch (error) {
        toast(t('music.uploadFailed'), `${file.name}: ${error.message}`, { tone: 'warn' });
      }
    }
    if (added) {
      await loadMedia(true);
      toast(t('music.addedToast'), t('music.added', { count: added }));
      await onDone();
    }
  };
  input.click();
}

async function libraryModal(onDone) {
  const found = await api.scanVault();
  if (found.discovered) await loadMedia(true);

  const taken = new Set(playlist().map((track) => track.asset_id));
  const options = mediaOfKind('audio').filter((asset) => !taken.has(asset.id));

  if (!options.length) {
    toast(t('common.empty'), t('music.allTaken'), { tone: 'warn' });
    return;
  }

  const chosen = new Set();
  const content = el(
    'div',
    { class: 'list' },
    options.map((asset) =>
      el(
        'label',
        { class: 'list-item', style: { cursor: 'pointer' } },
        el('input', {
          type: 'checkbox',
          style: { width: '16px', height: '16px', accentColor: 'var(--accent)' },
          onchange: (event) => {
            if (event.target.checked) chosen.add(asset.id);
            else chosen.delete(asset.id);
          },
        }),
        el(
          'div',
          { class: 'title' },
          el('div', { text: asset.title }),
          el('small', {
            text: `${asset.origin === 'preset' ? t('common.preset') : t('common.own')} · ${formatBytes(
              asset.size_bytes
            )}`,
          })
        )
      )
    )
  );

  const submit = el('button', { class: 'btn primary', text: t('music.add') });
  openModal({
    title: t('music.fromLibrary'),
    subtitle: found.discovered
      ? t('music.libraryFound', { count: found.discovered })
      : t('music.librarySubtitle'),
    content: [content],
    actions: [el('button', { class: 'btn ghost', text: t('common.cancel'), onclick: closeModal }), submit],
  });

  submit.onclick = async () => {
    if (!chosen.size) return;
    submit.disabled = true;
    for (const assetId of chosen) {
      try {
        await api.createTrack({ asset_id: assetId });
      } catch (error) {
        toast(t('music.addFailed'), error.message, { tone: 'warn' });
      }
    }
    closeModal();
    await onDone();
  };
}
