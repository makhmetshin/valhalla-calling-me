const BASE = '/api';

async function request(method, path, body, options = {}) {
  const init = { method, headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload.detail) {
        detail = typeof payload.detail === 'string'
          ? payload.detail
          : payload.detail.map((item) => item.msg || item).join('; ');
      }
    } catch (error) {
      void error;
    }
    throw new Error(detail);
  }
  if (response.status === 204 || options.raw) return null;
  return response.json();
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const patch = (path, body) => request('PATCH', path, body);
const put = (path, body) => request('PUT', path, body);
const remove = (path) => request('DELETE', path);

export const api = {
  overview: () => get('/overview'),

  preferences: () => get('/preferences'),
  savePreferences: (values) => put('/preferences', { values }),
  resetPreferences: (keys = []) => {
    const query = keys.map((key) => `keys=${encodeURIComponent(key)}`).join('&');
    return post(`/preferences/reset${query ? `?${query}` : ''}`);
  },

  media: (kind) => get(`/media${kind ? `?kind=${kind}` : ''}`),
  uploadMedia: (file, title = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    return request('POST', '/media', form);
  },
  renameMedia: (id, title) => patch(`/media/${id}`, { title }),
  deleteMedia: (id) => remove(`/media/${id}`),

  groups: () => get('/achievements/groups'),
  createGroup: (payload) => post('/achievements/groups', payload),
  updateGroup: (id, payload) => patch(`/achievements/groups/${id}`, payload),
  deleteGroup: (id) => remove(`/achievements/groups/${id}`),

  achievements: () => get('/achievements'),
  achievementProgress: () => get('/achievements/progress'),
  createAchievement: (payload) => post('/achievements', payload),
  updateAchievement: (id, payload) => patch(`/achievements/${id}`, payload),
  deleteAchievement: (id) => remove(`/achievements/${id}`),
  unlockAchievement: (id) => post(`/achievements/${id}/unlock`),
  lockAchievement: (id) => post(`/achievements/${id}/lock`),
  reorderAchievements: (ids) => post('/achievements/order', { ids }),

  metrics: () => get('/metrics'),
  createMetric: (payload) => post('/metrics', payload),
  updateMetric: (id, payload) => patch(`/metrics/${id}`, payload),
  deleteMetric: (id) => remove(`/metrics/${id}`),
  adjustMetric: (id, payload) => post(`/metrics/${id}/adjust`, payload),
  metricHistory: (id) => get(`/metrics/${id}/history`),

  tasks: () => get('/tasks'),
  createTask: (payload) => post('/tasks', payload),
  updateTask: (id, payload) => patch(`/tasks/${id}`, payload),
  deleteTask: (id) => remove(`/tasks/${id}`),
  setTaskState: (id, state) => post(`/tasks/${id}/state`, { state }),
  reorderTasks: (ids) => post('/tasks/order', { ids }),

  plans: () => get('/plans'),
  plan: (isoDate) => get(`/plans/${isoDate}`),
  savePlan: (payload) => put('/plans', payload),
  deletePlan: (id) => remove(`/plans/${id}`),

  reminders: () => get('/reminders'),
  dueReminders: () => get('/reminders/due'),
  createReminder: (payload) => post('/reminders', payload),
  updateReminder: (id, payload) => patch(`/reminders/${id}`, payload),
  deleteReminder: (id) => remove(`/reminders/${id}`),
  acknowledgeReminder: (id) => post(`/reminders/${id}/acknowledge`),
  snoozeReminder: (id, minutes) => post(`/reminders/${id}/snooze`, { minutes }),

  codexOutline: () => get('/codex/outline'),
  codexReadingOrder: () => get('/codex/reading-order'),
  codexSearch: (query) => get(`/codex/search?q=${encodeURIComponent(query)}`),
  createChapter: (payload) => post('/codex/chapters', payload),
  updateChapter: (id, payload) => patch(`/codex/chapters/${id}`, payload),
  deleteChapter: (id) => remove(`/codex/chapters/${id}`),
  entry: (id) => get(`/codex/entries/${id}`),
  createEntry: (payload) => post('/codex/entries', payload),
  updateEntry: (id, payload) => patch(`/codex/entries/${id}`, payload),
  deleteEntry: (id) => remove(`/codex/entries/${id}`),

  playlists: () => get('/music/playlists'),
  createPlaylist: (payload) => post('/music/playlists', payload),
  updatePlaylist: (id, payload) => patch(`/music/playlists/${id}`, payload),
  deletePlaylist: (id, withFiles = false) =>
    remove(`/music/playlists/${id}?with_files=${withFiles}`),
  reorderPlaylists: (ids) => post('/music/playlists/order', { ids }),

  tracks: (playlistId) =>
    get(`/music/tracks${playlistId ? `?playlist_id=${playlistId}` : ''}`),
  createTrack: (payload) => post('/music/tracks', payload),
  uploadTrack: (playlistId, file, title = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('playlist_id', String(playlistId));
    form.append('title', title);
    return request('POST', '/music/tracks/upload', form);
  },
  updateTrack: (id, payload) => patch(`/music/tracks/${id}`, payload),
  deleteTrack: (id, withFile = false) => remove(`/music/tracks/${id}?with_file=${withFile}`),
  reorderTracks: (ids) => post('/music/tracks/order', { ids }),
  trackPlayed: (id) => post(`/music/tracks/${id}/played`),

  links: (kind, id) => get(`/links?kind=${kind}&entity_id=${id}`),
  linkCatalog: () => get('/links/catalog'),
  createLink: (payload) => post('/links', payload),
  deleteLink: (id) => remove(`/links/${id}`),

  vault: () => get('/vault'),
  backups: () => get('/vault/backups'),
  createBackup: () => post('/vault/backups'),
  restoreBackup: (name) => post('/vault/backups/restore', { name }),
  deleteBackup: (name) => remove(`/vault/backups/${encodeURIComponent(name)}`),
  syncPresets: () => post('/vault/presets/sync'),
  scanVault: () => post('/vault/scan'),
};
