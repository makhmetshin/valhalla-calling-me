import { api } from '../core/api.js';
import { el, mount } from '../core/dom.js';
import { minutesToHuman, toIsoDate } from '../core/format.js';
import { t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { entityLink, focusTarget } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { celebrateAll, toast } from '../core/toast.js';

const UNIT_PRESETS = [10, 15, 20, 25, 30, 45, 60, 90];

export async function renderPlan(container, params = {}) {
  const state = {
    date: toIsoDate(new Date()),
    unit: 25,
    pause: 5,
    start: '09:00',
    title: '',
    notes: '',
    slots: [],
    planId: null,
  };

  let tasks = await api.tasks();
  const taskById = (id) => tasks.find((task) => task.id === id) || null;
  const openTasks = () => tasks.filter((task) => task.state !== 'done' && task.state !== 'abandoned');

  const board = el('div', { class: 'split' });
  mount(container, board);

  setHeader(t('nav.plan'), t('plan.subtitle'), [
    el('button', { class: 'btn ghost', text: t('plan.allPlans'), onclick: () => plansModal(container) }),
  ]);

  async function loadDate(isoDate) {
    state.date = isoDate;
    try {
      const plan = await api.plan(isoDate);
      state.planId = plan.id;
      state.unit = plan.unit_minutes;
      state.pause = plan.break_minutes;
      state.start = plan.starts_at.slice(0, 5);
      state.title = plan.title;
      state.notes = plan.notes;
      state.slots = plan.slots.map((slot) => ({
        task_id: slot.task_id,
        label: slot.label,
        units: slot.units,
      }));
    } catch (error) {
      void error;
      state.planId = null;
      state.slots = [];
      state.title = '';
      state.notes = '';
    }
    draw();
  }

  function schedule() {
    const [hours, minutes] = state.start.split(':').map(Number);
    let cursor = hours * 60 + minutes;
    return state.slots.map((slot, index) => {
      if (index) cursor += state.pause;
      const from = cursor;
      cursor += slot.units * state.unit;
      return { ...slot, from, to: cursor, index };
    });
  }

  const clock = (value) => {
    const total = ((value % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  function draw() {
    const computed = schedule();
    const totalMinutes = computed.length
      ? computed[computed.length - 1].to - (Number(state.start.split(':')[0]) * 60 + Number(state.start.split(':')[1]))
      : 0;

    const setup = el(
      'div',
      { class: 'card stack' },
      el('h3', { text: t('plan.base') }),
      field(
        t('plan.date'),
        el(
          'div',
          { class: 'row wrap', style: { gap: '6px' } },
          el('button', {
            class: 'btn sm',
            text: '‹',
            title: t('plan.prevDay'),
            onclick: () => shiftDay(-1),
          }),
          el('input', {
            type: 'date',
            value: state.date,
            style: { flex: '1 1 120px' },
            onchange: (event) => loadDate(event.target.value),
          }),
          el('button', {
            class: 'btn sm',
            text: '›',
            title: t('plan.nextDay'),
            onclick: () => shiftDay(1),
          }),
          el('button', {
            class: 'btn sm ghost',
            text: t('plan.today'),
            onclick: () => loadDate(toIsoDate(new Date())),
          })
        )
      ),
      field(t('plan.start'), el('input', {
        type: 'time',
        value: state.start,
        onchange: (event) => {
          state.start = event.target.value || '09:00';
          draw();
        },
      })),
      field(
        t('plan.unit'),
        el(
          'div',
          { class: 'chips' },
          UNIT_PRESETS.map((value) =>
            el('button', {
              class: `chip${state.unit === value ? ' on' : ''}`,
              text: `${value} ${t('common.minutesShort')}`,
              onclick: () => {
                state.unit = value;
                draw();
              },
            })
          )
        )
      ),
      field(t('plan.break'), el('input', {
        type: 'number',
        min: 0,
        value: state.pause,
        onchange: (event) => {
          state.pause = Number(event.target.value) || 0;
          draw();
        },
      })),
      field(t('plan.dayTitle'), el('input', {
        type: 'text',
        value: state.title,
        placeholder: t('plan.dayTitlePlaceholder'),
        oninput: (event) => {
          state.title = event.target.value;
        },
      })),
      field(t('plan.note'), el('textarea', {
        rows: 3,
        value: state.notes,
        oninput: (event) => {
          state.notes = event.target.value;
        },
      })),
      el('div', { class: 'section-title', text: t('plan.takeTask') }),
      el(
        'div',
        { class: 'chips' },
        openTasks().length
          ? openTasks().map((task) =>
              el('button', {
                class: 'chip',
                text: task.title,
                onclick: () => {
                  state.slots.push({ task_id: task.id, label: task.title, units: task.units || 1 });
                  draw();
                },
              })
            )
          : el('span', { class: 'muted', text: t('plan.noOpenTasks') })
      ),
      el('button', {
        class: 'btn',
        text: t('plan.freeBlock'),
        onclick: () =>
          formModal({
            title: t('plan.freeBlockTitle'),
            fields: [{ name: 'label', label: t('plan.freeBlockLabel'), value: '' }],
            submitLabel: t('plan.freeBlockSubmit'),
            onSubmit: (values) => {
              if (!values.label.trim()) throw new Error(t('common.titleRequired'));
              state.slots.push({ task_id: null, label: values.label, units: 1 });
              draw();
            },
          }),
      })
    );

    const timeline = el(
      'div',
      { class: 'stack' },
      el(
        'div',
        { class: 'row between' },
        el('h3', { text: state.date }),
        el('span', {
          class: 'muted',
          text: computed.length
            ? t('plan.until', {
                duration: minutesToHuman(totalMinutes),
                time: clock(computed[computed.length - 1].to),
              })
            : t('plan.nothing'),
        })
      ),
      computed.length
        ? el(
            'div',
            { class: 'timeline' },
            computed.map((slot) => {
              const task = slot.task_id ? taskById(slot.task_id) : null;
              const isDone = Boolean(task) && task.state === 'done';
              return el(
                'div',
                { class: `slot${isDone ? ' done' : ''}` },
                task
                  ? el('button', {
                      class: `checkmark${isDone ? ' on' : ''}`,
                      text: '✓',
                      title: isDone ? t('plan.markOpen') : t('plan.markDone'),
                      onclick: () => setDone(task, !isDone),
                    })
                  : null,
                el('time', { text: `${clock(slot.from)} — ${clock(slot.to)}` }),
                el(
                  'div',
                  { class: 'title', style: { flex: '1' } },
                  slot.task_id
                    ? entityLink('task', slot.task_id, slot.label)
                    : el('div', { text: slot.label })
                ),
                el('span', { class: 'units', text: `${slot.units}×${state.unit}${t('common.minutesShort')}` }),
                stepper(slot.index),
                el('button', {
                  class: 'btn ghost sm',
                  text: '↑',
                  onclick: () => move(slot.index, -1),
                }),
                el('button', {
                  class: 'btn ghost sm',
                  text: '↓',
                  onclick: () => move(slot.index, 1),
                }),
                el('button', {
                  class: 'btn ghost sm danger',
                  text: '✕',
                  onclick: () => {
                    state.slots.splice(slot.index, 1);
                    draw();
                  },
                })
              );
            })
          )
        : el(
            'div',
            { class: 'empty' },
            el('h3', { text: t('plan.emptyTitle') }),
            el('p', { text: t('plan.emptyHint') })
          ),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', text: t('plan.save'), onclick: save }),
        state.planId
          ? el('button', {
              class: 'btn ghost danger',
              text: t('plan.delete'),
              onclick: async () => {
                const yes = await confirmAction({
                  title: t('plan.deleteTitle'),
                  message: t('plan.deleteText', { date: state.date }),
                });
                if (!yes) return;
                await api.deletePlan(state.planId);
                await loadDate(state.date);
              },
            })
          : null,
        state.planId
          ? el('button', {
              class: 'btn ghost',
              text: t('common.links'),
              onclick: () => openLinks('day_plan', state.planId, state.date),
            })
          : null
      )
    );

    mount(board, setup, timeline);
  }

  function stepper(index) {
    return el(
      'div',
      { class: 'row', style: { gap: '4px' } },
      el('button', {
        class: 'btn ghost sm',
        text: '−',
        onclick: () => {
          state.slots[index].units = Math.max(1, state.slots[index].units - 1);
          draw();
        },
      }),
      el('button', {
        class: 'btn ghost sm',
        text: '+',
        onclick: () => {
          state.slots[index].units += 1;
          draw();
        },
      })
    );
  }

  async function setDone(task, done) {
    const result = await api.setTaskState(task.id, done ? 'done' : 'open');
    tasks = await api.tasks();
    if (done) celebrateAll(result.unlocked);
    draw();
  }

  function shiftDay(days) {
    const moment = new Date(`${state.date}T12:00:00`);
    moment.setDate(moment.getDate() + days);
    loadDate(toIsoDate(moment));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.slots.length) return;
    const [item] = state.slots.splice(index, 1);
    state.slots.splice(target, 0, item);
    draw();
  }

  async function save() {
    try {
      const plan = await api.savePlan({
        plan_date: state.date,
        title: state.title,
        notes: state.notes,
        unit_minutes: state.unit,
        break_minutes: state.pause,
        starts_at: `${state.start}:00`,
        slots: state.slots.map((slot) => ({
          task_id: slot.task_id,
          label: slot.label,
          units: slot.units,
        })),
      });
      state.planId = plan.id;
      toast(t('plan.savedToast'), `${state.date} · ${minutesToHuman(plan.total_minutes)}`);
      draw();
    } catch (error) {
      toast(t('plan.saveFailed'), error.message, { tone: 'warn' });
    }
  }

  function field(label, control) {
    return el('label', { class: 'field' }, el('span', { text: label }), control);
  }

  await loadDate(await requestedDate(params, state.date));
}

async function requestedDate(params, fallback) {
  const focus = focusTarget(params);
  if (!focus || focus.kind !== 'day_plan') return fallback;
  const plans = await api.plans();
  const plan = plans.find((item) => item.id === focus.id);
  return plan ? plan.plan_date : fallback;
}

async function plansModal(container) {
  const { openModal, closeModal } = await import('../core/modal.js');
  const plans = await api.plans();
  openModal({
    title: t('plan.chronicle'),
    content: [
      plans.length
        ? el(
            'div',
            { class: 'list' },
            plans.map((plan) =>
              el(
                'div',
                { class: 'list-item' },
                el(
                  'div',
                  { class: 'title' },
                  el('div', { text: `${plan.plan_date}${plan.title ? ` — ${plan.title}` : ''}` }),
                  el('small', {
                    text: t('plan.blocks', {
                      count: plan.slots.length,
                      duration: minutesToHuman(plan.total_minutes),
                      time: plan.starts_at.slice(0, 5),
                    }),
                  })
                ),
                el('button', {
                  class: 'btn sm',
                  text: t('common.open'),
                  onclick: () => {
                    closeModal();
                    renderPlan(container).then(() => {
                      const input = container.querySelector('input[type="date"]');
                      if (input) {
                        input.value = plan.plan_date;
                        input.dispatchEvent(new Event('change'));
                      }
                    });
                  },
                })
              )
            )
          )
        : el('p', { class: 'muted', text: t('plan.noPlans') }),
    ],
    actions: [el('button', { class: 'btn ghost', text: t('common.close'), onclick: closeModal })],
  });
}
