import { mediaById, state } from './state.js';

const cache = new Map();

function volume() {
  const value = Number(state.preferences['audio.master_volume']);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.7;
}

export function playUrl(url) {
  if (!url || volume() === 0) return;
  let sound = cache.get(url);
  if (!sound) {
    sound = new Audio(url);
    cache.set(url, sound);
  }
  sound.currentTime = 0;
  sound.volume = volume();
  sound.play().catch(() => {});
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
