import { api } from './api.js';
import { clear, el, mount } from './dom.js';
import { t } from './i18n.js';
import { navigate } from './router.js';
import { emit, savePreferences, state } from './state.js';
import { toast } from './toast.js';

const dock = document.getElementById('player');
const sound = new Audio();
sound.preload = 'auto';

const player = {
  tracks: [],
  playlists: [],
  playlistId: null,
  index: -1,
  collapsed: false,
};

let progressBar = null;

export function playlist() {
  return player.tracks;
}

export function playlists() {
  return player.playlists;
}

export function activePlaylistId() {
  return player.playlistId;
}

export function activePlaylist() {
  return player.playlists.find((item) => item.id === player.playlistId) || null;
}

export function currentTrack() {
  return player.tracks[player.index] || null;
}

export function playerSnapshot() {
  return {
    track: currentTrack(),
    index: player.index,
    count: player.tracks.length,
    playlistId: player.playlistId,
    playing: isPlaying(),
  };
}

export function isPlaying() {
  return Boolean(sound.src) && !sound.paused;
}

export function musicVolume() {
  const value = Number(state.preferences['player.volume']);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.6;
}

export async function setMusicVolume(value) {
  sound.volume = Math.min(1, Math.max(0, value));
  await savePreferences({ 'player.volume': sound.volume });
}

export function playTrack(id) {
  const index = player.tracks.findIndex((item) => item.id === id);
  if (index >= 0) load(index, true);
}

export function next() {
  load(player.index + 1, true);
}

export function previous() {
  load(player.index - 1, true);
}

export function toggle() {
  if (!player.tracks.length) return;
  if (!sound.src) {
    load(Math.max(player.index, 0), true);
    return;
  }
  if (sound.paused) sound.play().catch(() => {});
  else sound.pause();
  announce();
}

export function stop() {
  sound.pause();
  sound.currentTime = 0;
  announce();
}

export async function selectPlaylist(playlistId) {
  if (player.playlistId === playlistId) return player.tracks;
  player.playlistId = playlistId;
  unload();
  player.index = -1;
  await savePreferences({ 'player.playlist_id': playlistId }).catch(() => {});
  return refreshPlaylist();
}

export async function refreshPlaylist() {
  const active = currentTrack();
  [player.playlists, player.tracks] = await Promise.all([
    api.playlists(),
    api.tracks(player.playlistId),
  ]);

  if (player.playlistId !== null && !player.playlists.some((item) => item.id === player.playlistId)) {
    player.playlistId = null;
    player.tracks = await api.tracks();
  }

  if (!player.tracks.length) {
    unload();
    player.index = -1;
    announce();
    return player.tracks;
  }

  const index = active ? player.tracks.findIndex((item) => item.id === active.id) : -1;
  if (index >= 0) {
    player.index = index;
  } else {
    if (active) unload();
    player.index = Math.min(Math.max(player.index, 0), player.tracks.length - 1);
  }
  announce();
  return player.tracks;
}

export async function initPlayer() {
  player.collapsed = Boolean(state.preferences['player.collapsed']);
  player.playlistId = state.preferences['player.playlist_id'] ?? null;
  sound.volume = musicVolume();
  await refreshPlaylist();

  const lastId = state.preferences['player.track_id'];
  const index = player.tracks.findIndex((item) => item.id === lastId);
  if (index >= 0) {
    player.index = index;
    sound.src = player.tracks[index].asset.url;
  }
  announce();
}

function load(index, autoplay) {
  if (!player.tracks.length) return;
  const size = player.tracks.length;
  const bounded = ((index % size) + size) % size;
  const track = player.tracks[bounded];

  player.index = bounded;
  sound.src = track.asset.url;
  sound.volume = musicVolume();
  savePreferences({ 'player.track_id': track.id }).catch(() => {});

  if (autoplay) {
    sound
      .play()
      .then(() => {
        track.play_count += 1;
        return api.trackPlayed(track.id);
      })
      .catch(() => {});
  }
  announce();
}

function unload() {
  sound.pause();
  sound.removeAttribute('src');
  sound.load();
}

function setCollapsed(value) {
  player.collapsed = value;
  savePreferences({ 'player.collapsed': value }).catch(() => {});
  announce();
}

function announce() {
  render();
  emit('player', playerSnapshot());
}

function render() {
  if (!player.tracks.length) {
    dock.classList.remove('live');
    clear(dock);
    progressBar = null;
    return;
  }

  const track = currentTrack();
  const playing = isPlaying();
  progressBar = el('i');

  const line = el(
    'div',
    {
      class: 'player-progress',
      title: t('music.seek'),
      onmousedown: (event) => {
        if (event.button) return;
        event.preventDefault();
        seekAt(event, line);
        const drag = (moving) => seekAt(moving, line);
        const release = () => {
          document.removeEventListener('mousemove', drag);
          document.removeEventListener('mouseup', release);
        };
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', release);
      },
    },
    progressBar
  );

  mount(
    dock,
    line,
    el(
      'button',
      {
        class: 'player-now',
        title: t('music.openPage'),
        onclick: () => navigate('music'),
      },
      el('strong', { text: track ? track.title : t('music.nothingChosen') }),
      el('span', { text: secondLine(track) })
    ),
    el(
      'div',
      { class: 'player-controls' },
      el('button', { class: 'player-btn', title: t('music.previous'), text: '◀◀', onclick: previous }),
      el('button', {
        class: 'player-btn main',
        title: playing ? t('music.pause') : t('music.play'),
        text: playing ? '❚❚' : '▶',
        onclick: toggle,
      }),
      el('button', { class: 'player-btn', title: t('music.next'), text: '▶▶', onclick: next }),
      el('button', {
        class: 'player-fold',
        title: player.collapsed ? t('music.expand') : t('music.collapse'),
        text: player.collapsed ? '›' : '‹',
        onclick: () => setCollapsed(!player.collapsed),
      })
    )
  );

  dock.classList.add('live');
  dock.classList.toggle('collapsed', player.collapsed);
  updateProgress();
}

function secondLine(track) {
  const album = activePlaylist();
  const parts = [track && track.artist ? track.artist : null, album ? album.name : null];
  return parts.filter(Boolean).join(' · ') || t('common.nameless');
}

function seekAt(event, node) {
  if (!Number.isFinite(sound.duration) || !sound.duration) return;
  const box = node.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  sound.currentTime = ratio * sound.duration;
  updateProgress();
}

function updateProgress() {
  if (!progressBar) return;
  const ratio = sound.duration ? sound.currentTime / sound.duration : 0;
  progressBar.style.width = `${ratio * 100}%`;
}

sound.addEventListener('play', announce);
sound.addEventListener('pause', announce);
sound.addEventListener('timeupdate', updateProgress);
sound.addEventListener('ended', () => load(player.index + 1, true));
sound.addEventListener('error', () => {
  const track = currentTrack();
  if (!sound.src || !track) return;
  toast(t('music.unreadable'), t('music.unreadableText', { name: track.title }), { tone: 'warn' });
});
