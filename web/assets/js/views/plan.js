import { api } from '../core/api.js';
import { confirmDialog, el, mount } from '../core/dom.js';
import { minutesToHuman, toIsoDate } from '../core/format.js';
import { openLinks } from '../core/links-ui.js';
import { setHeader } from '../core/router.js';
import { toast } from '../core/toast.js';

const UNIT_PRESETS = [10, 15, 20, 25, 30, 45, 60, 90];

export async function renderPlan(container) {
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

  const tasks = await api.tasks();
  const openTasks = tasks.filter((task) => task.state !== 'done' && task.state !== 'abandoned');

  const board = el('div', { class: 'split' });
  mount(container, board);

  setHeader('План дня', 'Единица времени, порядок тасок, количество единиц — расписание считается само', [
    el('button', { class: 'btn ghost', text: 'Все планы', onclick: () => plansModal(container) }),
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
      el('h3', { text: 'Основа' }),
      field('Дата', el('input', {
        type: 'date',
        value: state.date,
        onchange: (event) => loadDate(event.target.value),
      })),
      field('Начало', el('input', {
        type: 'time',
        value: state.start,
        onchange: (event) => {
          state.start = event.target.value || '09:00';
          draw();
        },
      })),
      field(
        'Единица времени',
        el(
          'div',
          { class: 'chips' },
          UNIT_PRESETS.map((value) =>
            el('button', {
              class: `chip${state.unit === value ? ' on' : ''}`,
              text: `${value} мин`,
              onclick: () => {
                state.unit = value;
                draw();
              },
            })
          )
        )
      ),
      field('Перерыв, мин', el('input', {
        type: 'number',
        min: 0,
        value: state.pause,
        onchange: (event) => {
          state.pause = Number(event.target.value) || 0;
          draw();
        },
      })),
      field('Название дня', el('input', {
        type: 'text',
        value: state.title,
        placeholder: 'например: день малых шагов',
        oninput: (event) => {
          state.title = event.target.value;
        },
      })),
      field('Заметка', el('textarea', {
        rows: 3,
        value: state.notes,
        oninput: (event) => {
          state.notes = event.target.value;
        },
      })),
      el('div', { class: 'section-title', text: 'Взять таску' }),
      el(
        'div',
        { class: 'chips' },
        openTasks.length
          ? openTasks.map((task) =>
              el('button', {
                class: 'chip',
                text: task.title,
                onclick: () => {
                  state.slots.push({ task_id: task.id, label: task.title, units: task.units || 1 });
                  draw();
                },
              })
            )
          : el('span', { class: 'muted', text: 'Открытых тасок нет' })
      ),
      el('button', {
        class: 'btn',
        text: '+ Свободный блок',
        onclick: () => {
          const label = window.prompt('Что за блок?');
          if (!label) return;
          state.slots.push({ task_id: null, label, units: 1 });
          draw();
        },
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
            ? `${minutesToHuman(totalMinutes)} · до ${clock(computed[computed.length - 1].to)}`
            : 'пусто',
        })
      ),
      computed.length
        ? el(
            'div',
            { class: 'timeline' },
            computed.map((slot) =>
              el(
                'div',
                { class: 'slot' },
                el('time', { text: `${clock(slot.from)} — ${clock(slot.to)}` }),
                el('div', { class: 'title', style: { flex: '1' } }, el('div', { text: slot.label })),
                el('span', { class: 'units', text: `${slot.units}×${state.unit}м` }),
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
              )
            )
          )
        : el('div', { class: 'empty' }, el('h3', { text: 'Расписание пустое' }), el('p', { text: 'Выбери таски слева — время посчитается само.' })),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', text: 'Сохранить план', onclick: save }),
        state.planId
          ? el('button', {
              class: 'btn ghost danger',
              text: 'Удалить план',
              onclick: async () => {
                if (!confirmDialog('Стереть план этого дня?')) return;
                await api.deletePlan(state.planId);
                await loadDate(state.date);
              },
            })
          : null,
        state.planId
          ? el('button', {
              class: 'btn ghost',
              text: 'Связи',
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
      toast('План закреплён', `${state.date} · ${minutesToHuman(plan.total_minutes)}`);
      draw();
    } catch (error) {
      toast('Не сохранилось', error.message, { tone: 'warn' });
    }
  }

  function field(label, control) {
    return el('label', { class: 'field' }, el('span', { text: label }), control);
  }

  await loadDate(state.date);
}

async function plansModal(container) {
  const { openModal, closeModal } = await import('../core/modal.js');
  const plans = await api.plans();
  openModal({
    title: 'Летопись планов',
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
                    text: `${plan.slots.length} блоков · ${minutesToHuman(plan.total_minutes)} · старт ${plan.starts_at.slice(0, 5)}`,
                  })
                ),
                el('button', {
                  class: 'btn sm',
                  text: 'Открыть',
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
        : el('p', { class: 'muted', text: 'Планов ещё не было' }),
    ],
    actions: [el('button', { class: 'btn ghost', text: 'Закрыть', onclick: closeModal })],
  });
}
