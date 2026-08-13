import { api } from './core/api.js';
import { applyFonts } from './core/backgrounds.js';
import { el } from './core/dom.js';
import { ENTITY_LABELS } from './core/format.js';
import { initPlayer } from './core/player.js';
import { navigate, registerRoutes, setBadge, startRouter } from './core/router.js';
import { loadMedia, loadPreferences } from './core/state.js';
import { playReminder } from './core/audio.js';
import { toast } from './core/toast.js';
import { renderAchievements } from './views/achievements.js';
import { renderCodex } from './views/codex.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMetrics } from './views/metrics.js';
import { renderMusic } from './views/music.js';
import { renderPlan } from './views/plan.js';
import { renderReminders } from './views/reminders.js';
import { renderSettings } from './views/settings.js';
import { renderTasks } from './views/tasks.js';

const ROUTES = [
  { name: 'dashboard', title: 'Чертог', icon: '/presets/icons/yggdrasil.svg', render: renderDashboard },
  { name: 'achievements', title: 'Ачивки', icon: '/presets/icons/valknut.svg', render: renderAchievements },
  { name: 'metrics', title: 'Метрики', icon: '/presets/icons/rune-stone.svg', render: renderMetrics },
  { name: 'tasks', title: 'Чек-лист', icon: '/presets/icons/axe.svg', render: renderTasks },
  { name: 'plan', title: 'План дня', icon: '/presets/icons/longship.svg', render: renderPlan },
  { name: 'reminders', title: 'Зовы', icon: '/presets/icons/raven.svg', render: renderReminders },
  { name: 'codex', title: 'Кодекс', icon: '/presets/icons/wolf.svg', render: renderCodex },
  { name: 'music', title: 'Музыка', icon: '/presets/icons/dawn-horn.svg', render: renderMusic },
  { name: 'settings', title: 'Настройки', icon: '/presets/icons/vegvisir.svg', render: renderSettings },
];

const REMINDER_INTERVAL = 30000;
const PROGRESS_INTERVAL = 60000;
const shown = new Set();

async function pollReminders() {
  try {
    const signals = await api.dueReminders();
    setBadge('reminders', signals.length || '');
    for (const signal of signals) {
      const key = `${signal.reminder.id}:${signal.due_at}`;
      if (shown.has(key)) continue;
      shown.add(key);
      playReminder(signal.reminder);
      toast(
        signal.reminder.title,
        [signal.reminder.message, signal.target_label ? `→ ${ENTITY_LABELS[signal.reminder.target_kind]}: ${signal.target_label}` : '']
          .filter(Boolean)
          .join('\n'),
        {
          sticky: true,
          icon: signal.reminder.icon,
          actions: [
            {
              label: 'Принято',
              run: async () => {
                await api.acknowledgeReminder(signal.reminder.id);
                shown.delete(key);
                pollReminders();
              },
            },
            {
              label: 'Позже',
              run: async () => {
                await api.snoozeReminder(signal.reminder.id, 15);
                shown.delete(key);
                pollReminders();
              },
            },
            ...(signal.reminder.target_kind
              ? [{ label: 'Открыть', run: () => navigate(routeForKind(signal.reminder.target_kind)) }]
              : []),
          ],
        }
      );
    }
  } catch (error) {
    void error;
  }
}

function routeForKind(kind) {
  switch (kind) {
    case 'achievement':
    case 'achievement_group':
      return 'achievements';
    case 'metric':
      return 'metrics';
    case 'task':
      return 'tasks';
    case 'day_plan':
      return 'plan';
    case 'codex_chapter':
    case 'codex_entry':
      return 'codex';
    case 'track':
      return 'music';
    default:
      return 'reminders';
  }
}

async function refreshProgress() {
  try {
    const progress = await api.achievementProgress();
    const ratio = progress.total ? progress.unlocked / progress.total : 0;
    const orb = document.getElementById('railProgress');
    orb.replaceChildren(el('i', { style: { width: `${ratio * 100}%` } }));
    orb.title = `${progress.unlocked} / ${progress.total}`;
  } catch (error) {
    void error;
  }
}

async function boot() {
  await Promise.all([loadPreferences(), loadMedia()]);
  applyFonts();
  registerRoutes(ROUTES);
  startRouter('dashboard');
  initPlayer();
  refreshProgress();
  pollReminders();
  setInterval(pollReminders, REMINDER_INTERVAL);
  setInterval(refreshProgress, PROGRESS_INTERVAL);
}

boot();
