import { api } from './core/api.js';
import { el } from './core/dom.js';
import { ENTITY_LABELS } from './core/format.js';
import { initPlayer } from './core/player.js';
import { openEntity } from './core/navigation.js';
import { registerRoutes, setBadge, startRouter } from './core/router.js';
import { loadMedia, loadPreferences } from './core/state.js';
import { applyAppearance } from './core/themes.js';
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
  { name: 'dashboard', title: 'Чертог', icon: 'yggdrasil', render: renderDashboard },
  { name: 'achievements', title: 'Ачивки', icon: 'valknut', render: renderAchievements },
  { name: 'metrics', title: 'Метрики', icon: 'rune-stone', render: renderMetrics },
  { name: 'tasks', title: 'Чек-лист', icon: 'axe', render: renderTasks },
  { name: 'plan', title: 'План дня', icon: 'longship', render: renderPlan },
  { name: 'reminders', title: 'Зовы', icon: 'raven', render: renderReminders },
  { name: 'codex', title: 'Кодекс', icon: 'wolf', render: renderCodex },
  { name: 'music', title: 'Музыка', icon: 'dawn-horn', render: renderMusic },
  { name: 'settings', title: 'Настройки', icon: 'vegvisir', render: renderSettings },
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
              ? [
                  {
                    label: 'Открыть',
                    run: () =>
                      openEntity(signal.reminder.target_kind, signal.reminder.target_id),
                  },
                ]
              : []),
          ],
        }
      );
    }
  } catch (error) {
    void error;
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
  applyAppearance();
  registerRoutes(ROUTES);
  startRouter('dashboard');
  initPlayer();
  refreshProgress();
  pollReminders();
  setInterval(pollReminders, REMINDER_INTERVAL);
  setInterval(refreshProgress, PROGRESS_INTERVAL);
}

boot();
