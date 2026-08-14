import { mediaById, state } from './state.js';

const cache = new Map();
const listeners = new Set();

const PREVIEW_SECONDS = 8;
const SIGNAL_SECONDS = 20;

let current = null;
let timer = null;

function volume() {
  const value = Number(state.preferences['audio.master_volume']);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.7;
}

function announce() {
  for (const listener of listeners) listener(current ? current.url : null);
}

export function onSound(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function soundPlaying(url) {
  if (!current) return false;
  return url ? current.url === url : true;
}

export function stopSound() {
  window.clearTimeout(timer);
  timer = null;
  if (current) {
    current.sound.pause();
    current.sound.currentTime = 0;
    current = null;
  }
  announce();
}

export function playUrl(url, seconds = SIGNAL_SECONDS) {
  if (!url || volume() === 0) return;
  stopSound();

  let sound = cache.get(url);
  if (!sound) {
    sound = new Audio(url);
    cache.set(url, sound);
  }
  sound.onended = () => {
    if (soundPlaying(url)) stopSound();
  };
  sound.currentTime = 0;
  sound.volume = volume();
  current = { url, sound };
  sound.play().catch(() => {});
  timer = window.setTimeout(stopSound, seconds * 1000);
  announce();
}

export function previewUrl(url) {
  playUrl(url, PREVIEW_SECONDS);
}

export function playAsset(mediaId, fallback) {
  const asset = mediaById(mediaId);
  playUrl(asset ? asset.url : fallback);
}

export function playUnlock(achievement) {
  const preferred = achievement && achievement.sound ? achievement.sound.url : null;
  playUrl(preferred || assetUrl('audio.unlock_sound_id'));
}

export function playReminder(reminder) {
  const preferred = reminder && reminder.sound ? reminder.sound.url : null;
  playUrl(preferred || assetUrl('audio.reminder_sound_id'));
}

function assetUrl(preferenceKey) {
  const asset = mediaById(state.preferences[preferenceKey]);
  return asset ? asset.url : null;
}
