import { api } from './api.js';

const listeners = new Map();

export const state = {
  preferences: {},
  media: [],
};

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event).delete(handler);
}

export function emit(event, payload) {
  for (const handler of listeners.get(event) || []) handler(payload);
}

export async function loadMedia(force = false) {
  if (force || state.media.length === 0) {
    state.media = await api.media();
    emit('media', state.media);
  }
  return state.media;
}

export function mediaById(id) {
  if (id === null || id === undefined) return null;
  return state.media.find((item) => item.id === id) || null;
}

export function mediaOfKind(kind) {
  return state.media.filter((item) => item.kind === kind);
}

export async function loadPreferences(force = false) {
  if (force || Object.keys(state.preferences).length === 0) {
    state.preferences = await api.preferences();
    emit('preferences', state.preferences);
  }
  return state.preferences;
}

export async function savePreferences(values) {
  state.preferences = await api.savePreferences(values);
  emit('preferences', state.preferences);
  return state.preferences;
}
