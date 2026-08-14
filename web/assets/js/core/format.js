import { locale, t } from './i18n.js';

export const CADENCE_KEYS = [
  'once',
  'every_15_minutes',
  'every_hour',
  'every_3_hours',
  'every_6_hours',
  'daily',
];

export const COLLECTION_KEYS = ['icons', 'backgrounds', 'playlist', 'uploads'];

export const ENTITY_KINDS = [
  'achievement',
  'achievement_group',
  'metric',
  'task',
  'day_plan',
  'reminder',
  'codex_chapter',
  'codex_entry',
  'tablet_kind',
  'tablet_page',
  'track',
];

export function cadenceLabel(value) {
  return t(`cadence.${value}`);
}

export function entityLabel(kind) {
  return t(`kind.${kind}`);
}

export function collectionLabel(name) {
  return t(`collection.${name}`);
}

export function taskStateLabel(value) {
  return t(`state.${value}`);
}

function dateFormat() {
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

function dateTimeFormat() {
  return new Intl.DateTimeFormat(locale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return t('common.dash');
  return dateFormat().format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return t('common.dash');
  return dateTimeFormat().format(new Date(value));
}

export function formatNumber(value) {
  if (value === null || value === undefined) return t('common.dash');
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
  const short = { h: t('common.hoursShort'), m: t('common.minutesShort') };
  if (!hours) return `${rest} ${short.m}`;
  return rest ? `${hours} ${short.h} ${rest} ${short.m}` : `${hours} ${short.h}`;
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
