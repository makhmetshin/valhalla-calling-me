const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
const DATETIME_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const CADENCE_LABELS = {
  every_15_minutes: 'каждые 15 минут',
  every_hour: 'каждый час',
  every_3_hours: 'каждые 3 часа',
  every_6_hours: 'каждые 6 часов',
  daily: 'раз в день',
};

export const ENTITY_LABELS = {
  achievement: 'ачивка',
  achievement_group: 'группа',
  metric: 'метрика',
  task: 'таска',
  day_plan: 'план',
  reminder: 'напоминание',
  codex_chapter: 'глава',
  codex_entry: 'страница',
  track: 'музыка',
};

export const TASK_STATES = {
  open: 'открыта',
  active: 'в бою',
  done: 'исполнена',
  abandoned: 'оставлена',
};

export function formatDate(value) {
  if (!value) return '—';
  return DATE_FORMAT.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return DATETIME_FORMAT.format(new Date(value));
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`;
}

export function toIsoDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function toIsoLocal(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function minutesToHuman(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export function renderProse(source) {
  const escaped = String(source || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('### ')) return `<h3>${inline(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith('## ')) return `<h3>${inline(trimmed.slice(3))}</h3>`;
      if (trimmed.startsWith('> ')) {
        return `<blockquote>${inline(trimmed.replace(/^> ?/gm, ''))}</blockquote>`;
      }
      if (/^[-*] /m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((line) => /^[-*] /.test(line.trim()))
          .map((line) => `<li>${inline(line.trim().slice(2))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(trimmed).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)_(.+?)_(\W|$)/g, '$1<em>$2</em>$3');
}
