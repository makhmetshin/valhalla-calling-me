import { api } from './core/api.js';
import { el } from './core/dom.js';
import { entityLabel } from './core/format.js';
import { language, t } from './core/i18n.js';
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

const ROUTES = () => [
  { name: 'dashboard', title: t('nav.dashboard'), icon: 'yggdrasil', render: renderDashboard },
  { name: 'achievements', title: t('nav.achievements'), icon: 'valknut', render: renderAchievements },
  { name: 'metrics', title: t('nav.metrics'), icon: 'rune-stone', render: renderMetrics },
  { name: 'tasks', title: t('nav.tasks'), icon: 'axe', render: renderTasks },
  { name: 'plan', title: t('nav.plan'), icon: 'longship', render: renderPlan },
  { name: 'reminders', title: t('nav.reminders'), icon: 'raven', render: renderReminders },
  { name: 'codex', title: t('nav.codex'), icon: 'wolf', render: renderCodex },
  { name: 'music', title: t('nav.music'), icon: 'dawn-horn', render: renderMusic },
  { name: 'settings', title: t('nav.settings'), icon: 'vegvisir', render: renderSettings },
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
        [signal.reminder.message, signal.target_label ? `→ ${entityLabel(signal.reminder.target_kind)}: ${signal.target_label}` : '']
          .filter(Boolean)
          .join('\n'),
        {
          sticky: true,
          icon: signal.reminder.icon,
          actions: [
            {
              label: t('rem.accept'),
              run: async () => {
                await api.acknowledgeReminder(signal.reminder.id);
                shown.delete(key);
                pollReminders();
              },
            },
            {
              label: t('rem.snooze'),
              run: async () => {
                await api.snoozeReminder(signal.reminder.id, 15);
                shown.delete(key);
                pollReminders();
              },
            },
            ...(signal.reminder.target_kind
              ? [
                  {
                    label: t('common.open'),
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
  document.documentElement.lang = language();
  document.getElementById('railMotto').textContent = t('nav.motto');
  registerRoutes(ROUTES());
  startRouter('dashboard');
  initPlayer();
  refreshProgress();
  pollReminders();
  setInterval(pollReminders, REMINDER_INTERVAL);
  setInterval(refreshProgress, PROGRESS_INTERVAL);
}

boot();
