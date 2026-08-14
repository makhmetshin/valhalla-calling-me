import { api } from '../core/api.js';
import { el, emptyState, mount } from '../core/dom.js';
import { formatBytes, formatDateTime } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { closeModal, formModal, openModal } from '../core/modal.js';
import { anchor, focusEntity } from '../core/navigation.js';
import {
  activePlaylistId,
  currentTrack,
  isPlaying,
  playTrack,
  playlist,
  playlists,
  refreshPlaylist,
  selectPlaylist,
  toggle,
} from '../core/player.js';
import { setHeader } from '../core/router.js';
import { loadMedia, on } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderMusic(container, params = {}) {
  container.dispatchEvent(new CustomEvent('view:teardown'));
  await Promise.all([loadMedia(), refreshPlaylist()]);

  const reload = () => renderMusic(container);
  const current = activePlaylistId();

  drawHeader(current, reload);

  if (!playlists().length) {
    mount(
      container,
      emptyState(
        t('music.noPlaylists'),
        t('music.noPlaylistsHint'),
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: t('music.newPlaylist'),
          onclick: () => playlistForm(null, reload),
        })
      )
    );
    return;
  }

  const board = el('div', { class: 'split' });
  const shelf = el('div', { class: 'stack' });
  const stage = el('div', { class: 'stack' });
  mount(board, shelf, stage);

  const paint = () => {
    const chosen = activePlaylistId();
    drawHeader(chosen, reload);
    mount(
      shelf,
      el('div', { class: 'section-title' }, el('span', { text: t('music.playlists') })),
      generalCard(playlists(), chosen),
      playlists().map((album) => playlistCard(album, chosen, reload))
    );
    mount(stage, trackList(playlist(), chosen, reload));
  };
  paint();

  const off = on('player', paint);
  container.addEventListener('view:teardown', off, { once: true });

  mount(container, board);
  focusEntity(container, params);
}

function drawHeader(current, reload) {
  setHeader(t('nav.music'), t('music.subtitle', { count: playlist().length }), [
    el('button', {
      class: 'btn',
      text: t('music.newPlaylist'),
      onclick: () => playlistForm(null, reload),
    }),
    el('button', {
      class: 'btn primary',
      text: t('music.upload'),
      disabled: current === null,
      title: current === null ? t('music.pickPlaylist') : '',
      onclick: () => upload(current, reload),
    }),
  ]);
}

function generalCard(albums, current) {
  const total = albums.reduce((sum, album) => sum + album.track_count, 0);
  return el(
    'button',
    {
      class: `playlist-card${current === null ? ' on' : ''}`,
      onclick: () => selectPlaylist(null),
    },
    el('span', { class: 'playlist-cover blank', text: '✦' }),
    el(
      'span',
      { class: 'playlist-body' },
      el('strong', { text: t('music.general') }),
      el('small', { text: t('music.generalHint', { count: total }) })
    )
  );
}

function playlistCard(album, current, reload) {
  return el(
    'div',
    { class: `playlist-row${album.id === current ? ' on' : ''}` },
    el(
      'button',
      { class: 'playlist-card', onclick: () => selectPlaylist(album.id) },
      album.cover_url
        ? el('img', { class: 'playlist-cover', src: album.cover_url, alt: album.name })
        : el('span', { class: 'playlist-cover blank', text: '♪' }),
      el(
        'span',
        { class: 'playlist-body' },
        el('strong', { text: album.name }),
        el('small', { text: t('music.trackCount', { count: album.track_count }) })
      )
    ),
    el(
      'div',
      { class: 'playlist-tools' },
      el('button', {
        class: 'btn sm ghost',
        text: '⚙',
        title: t('common.edit'),
        onclick: () => playlistForm(album, reload),
      }),
      el('button', {
        class: 'btn sm ghost danger',
        text: '✕',
        title: t('music.deletePlaylistTitle'),
        onclick: () => removePlaylist(album, reload),
      })
    )
  );
}

function trackList(tracks, current, reload) {
  if (!tracks.length) {
    return emptyState(
      t('music.emptyTitle'),
      current === null ? t('music.emptyGeneralHint') : t('music.emptyHint')
    );
  }
  return el(
    'div',
    { class: 'list' },
    tracks.map((track, index) => row(track, index, tracks, current, reload))
  );
}

function row(track, index, tracks, current, reload) {
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
    current !== null
      ? el('button', { class: 'btn sm ghost', text: '↑', onclick: () => move(-1) })
      : null,
    current !== null
      ? el('button', { class: 'btn sm ghost', text: '↓', onclick: () => move(1) })
      : null,
    el('button', {
      class: 'btn sm ghost',
      text: t('common.links'),
      onclick: () => openLinks('track', track.id, track.title),
    }),
    el('button', {
      class: 'btn sm ghost',
      text: t('common.edit'),
      onclick: () => trackForm(track, reload),
    }),
    el('button', {
      class: 'btn sm ghost danger',
      text: '✕',
      onclick: () => removeTrack(track, reload),
    })
  );
}

function playlistForm(album, onDone) {
  formModal({
    title: album ? t('music.playlistEdit') : t('music.newPlaylist'),
    subtitle: t('music.playlistHint'),
    fields: [
      { name: 'name', label: t('music.playlistName'), value: album?.name || '' },
      {
        name: 'icon_id',
        label: t('music.cover'),
        type: 'media',
        kind: 'image',
        value: album?.icon_id ?? null,
        help: t('music.coverHint'),
      },
    ],
    onSubmit: async (values) => {
      if (!values.name.trim()) throw new Error(t('common.titleRequired'));
      if (album) await api.updatePlaylist(album.id, values);
      else await api.createPlaylist(values);
      toast(t('music.playlistSaved'), values.name);
      await onDone();
    },
  });
}

function removePlaylist(album, onDone) {
  const drop = async (withFiles) => {
    closeModal();
    try {
      await api.deletePlaylist(album.id, withFiles);
      await onDone();
    } catch (error) {
      toast(t('music.removeFailed'), error.message, { tone: 'warn' });
    }
  };

  openModal({
    title: t('music.deletePlaylistTitle'),
    subtitle: album.name,
    content: [el('p', { class: 'muted', text: t('music.deletePlaylistText') })],
    actions: [
      el('button', { class: 'btn ghost', text: t('common.cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn ghost danger',
        text: t('music.removeWithFiles'),
        onclick: () => drop(true),
      }),
      el('button', {
        class: 'btn primary',
        text: t('music.removeKeepFiles'),
        onclick: () => drop(false),
      }),
    ],
  });
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
    content: [el('p', { class: 'muted', text: t('music.removeHint') })],
    actions: [
      el('button', { class: 'btn ghost', text: t('common.cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn ghost danger',
        text: t('music.removeWithFile'),
        onclick: () => drop(true),
      }),
      el('button', {
        class: 'btn primary',
        text: t('music.removeFromList'),
        onclick: () => drop(false),
      }),
    ],
  });
}

function upload(playlistId, onDone) {
  const input = el('input', { type: 'file', accept: 'audio/*', multiple: true });
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        await api.uploadTrack(playlistId, file, file.name.replace(/\.[^.]+$/, ''));
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
