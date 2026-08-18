import { api } from '../core/api.js';
import { el, emptyState, glyph, mount } from '../core/dom.js';
import { formatDate, formatDateTime, toIsoLocal } from '../core/format.js';
import { language, t } from '../core/i18n.js';
import { closeModal, confirmAction, openModal } from '../core/modal.js';
import { setHeader } from '../core/router.js';
import { toast } from '../core/toast.js';

const RUNES = ['rune-isa', 'rune-kenaz', 'rune-raidho', 'rune-naudhiz', 'rune-thurisaz'];

const RANGES = [
  { key: 'test.range30', days: 30 },
  { key: 'test.range90', days: 90 },
  { key: 'test.range365', days: 365 },
  { key: 'test.rangeAll', days: null },
];

const DAY = 86400000;

export async function renderAssessments(container) {
  const tongue = language();
  const shelf = await api.assessments(tongue);

  setHeader(t('nav.assessments'), t('test.subtitle'));

  if (!shelf.length) {
    mount(container, emptyState(t('test.emptyTitle'), t('test.emptyHint')));
    return;
  }

  const state = { slug: shelf[0].slug, days: 90 };

  async function overview() {
    const summary = shelf.find((item) => item.slug === state.slug) || shelf[0];
    const attempts = await api.assessmentAttempts(state.slug, tongue, stretch(state.days));

    const blocks = [];
    if (shelf.length > 1) {
      blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('test.pick') })));
      blocks.push(
        el(
          'div',
          { class: 'trial-shelf' },
          shelf.map((item) =>
            el('button', {
              class: `chip${item.slug === state.slug ? ' on' : ''}`,
              text: item.title,
              onclick: () => {
                state.slug = item.slug;
                overview();
              },
            })
          )
        )
      );
    }

    blocks.push(banner(summary));
    blocks.push(
      el(
        'div',
        { class: 'section-title' },
        el('span', { text: t('test.chart') }),
        el('span', { class: 'muted', text: t('test.chartHint') })
      )
    );
    blocks.push(ranges());
    blocks.push(
      attempts.length
        ? el('div', { class: 'trial-chart' }, chart(attempts, summary))
        : el('p', { class: 'muted', text: t('test.rangeEmpty') })
    );
    blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('test.history') })));
    blocks.push(attempts.length ? history(attempts) : noHistory());

    mount(container, blocks);
  }

  function banner(summary) {
    return el(
      'div',
      { class: 'trial-head' },
      glyph('urd-well'),
      el(
        'div',
        { style: { flex: '1 1 320px', minWidth: '0' } },
        el('h3', { text: summary.title }),
        el('div', {
          class: 'muted',
          text: t('test.source', { author: summary.author, source: summary.source }),
        }),
        el('p', { text: summary.about }),
        el(
          'div',
          { class: 'row wrap', style: { gap: '14px', marginTop: '12px' } },
          el('span', {
            class: 'muted',
            text: t('test.questions', { count: summary.question_count }),
          }),
          el('span', { class: 'muted', text: t('test.attempts', { count: summary.attempts }) }),
          el('span', {
            class: 'muted',
            text: summary.latest
              ? t('test.lastResult', {
                  score: summary.latest.score,
                  max: summary.latest.max_score,
                  band: summary.latest.band_title,
                })
              : t('test.never'),
          })
        )
      ),
      el('button', {
        class: 'btn primary',
        text: summary.attempts ? t('test.retake') : t('test.start'),
        onclick: () => run(),
      })
    );
  }

  function ranges() {
    return el(
      'div',
      { class: 'chips' },
      RANGES.map((range) =>
        el('button', {
          class: `chip${state.days === range.days ? ' on' : ''}`,
          text: t(range.key),
          onclick: () => {
            state.days = range.days;
            overview();
          },
        })
      )
    );
  }

  function history(attempts) {
    return el(
      'div',
      { class: 'list' },
      [...attempts].reverse().map((attempt) =>
        el(
          'div',
          { class: 'list-item' },
          el(
            'button',
            {
              class: 'title link-row',
              title: t('test.openAttempt'),
              onclick: () => showAttempt(attempt.id),
            },
            el('div', {
              text: `${formatDateTime(attempt.taken_at)} · ${t('test.score', {
                score: attempt.score,
                max: attempt.max_score,
              })}`,
            }),
            el('small', { text: [attempt.band_title, attempt.note].filter(Boolean).join(' — ') })
          ),
          attempt.alarming ? el('span', { class: 'chip danger', text: t('test.alarm') }) : null,
          el('button', {
            class: 'btn ghost sm danger',
            text: '✕',
            title: t('test.deleteHint'),
            onclick: async () => {
              const yes = await confirmAction({
                title: t('test.deleteTitle'),
                message: t('test.deleteText', { when: formatDateTime(attempt.taken_at) }),
              });
              if (!yes) return;
              await api.deleteAttempt(attempt.id);
              await refreshShelf();
            },
          })
        )
      )
    );
  }

  function noHistory() {
    return emptyState(t('test.historyEmpty'), t('test.historyHint'));
  }

  async function showAttempt(id) {
    openReport(await api.assessmentAttempt(id, tongue), t('common.close'));
  }

  async function run() {
    const instrument = await api.assessment(state.slug, tongue);
    const answers = new Map();

    const counted = el('span', { class: 'muted' });
    const summed = el('span', { class: 'muted' });
    const bar = el('i');
    const hint = el('span', { class: 'muted' });
    const finish = el('button', { class: 'btn primary', text: t('test.finish') });
    const note = el('textarea', {
      rows: 3,
      placeholder: t('test.notePlaceholder'),
      style: { width: '100%' },
    });

    const retally = () => {
      const total = instrument.question_count;
      const left = total - answers.size;
      counted.textContent = t('test.progress', { done: answers.size, total });
      summed.textContent = t('test.score', {
        score: tally(answers),
        max: instrument.max_score,
      });
      bar.style.width = `${(answers.size / total) * 100}%`;
      hint.textContent = left ? t('test.answerAll', { count: left }) : '';
      finish.disabled = left > 0;
    };

    finish.onclick = async () => {
      finish.disabled = true;
      try {
        const attempt = await api.recordAttempt(state.slug, tongue, {
          answers: Object.fromEntries(answers),
          note: note.value,
        });
        toast(t('test.saved'), t('test.score', { score: attempt.score, max: attempt.max_score }));
        await refreshShelf();
        openReport(attempt, t('test.done'));
      } catch (error) {
        toast(t('common.failed'), error.message, { tone: 'warn' });
        retally();
      }
    };

    const blocks = [
      el(
        'div',
        { class: 'trial-head' },
        glyph('urd-well'),
        el(
          'div',
          { style: { flex: '1 1 320px', minWidth: '0' } },
          el('h3', { text: instrument.title }),
          el('p', { class: 'trial-lead', text: instrument.lead })
        ),
        el('button', {
          class: 'btn ghost',
          text: t('test.leave'),
          onclick: async () => {
            const yes = await confirmAction({
              title: t('test.leaveTitle'),
              message: t('test.leaveText'),
              confirmLabel: t('test.leave'),
            });
            if (yes) overview();
          },
        })
      ),
      el('div', { class: 'row between', style: { marginTop: '18px' } }, counted, summed),
      el('div', { class: 'meter' }, bar),
    ];

    let number = 0;
    for (const section of instrument.sections) {
      blocks.push(el('div', { class: 'section-title' }, el('span', { text: section.title })));
      blocks.push(
        el(
          'div',
          { class: 'list' },
          section.questions.map((question) => {
            number += 1;
            return ask(question, number, instrument.choices, answers, retally);
          })
        )
      );
    }

    blocks.push(el('div', { class: 'section-title' }, el('span', { text: t('test.note') })));
    blocks.push(note);
    blocks.push(
      el('div', { class: 'row', style: { marginTop: '18px', gap: '14px' } }, finish, hint)
    );

    retally();
    mount(container, blocks);
  }

  async function refreshShelf() {
    const fresh = await api.assessments(tongue);
    shelf.splice(0, shelf.length, ...fresh);
    await overview();
  }

  await overview();
}

function stretch(days) {
  if (!days) return {};
  return { since: `${toIsoLocal(new Date(Date.now() - days * DAY))}:00` };
}

function ask(question, number, choices, answers, retally) {
  const row = el(
    'div',
    { class: 'trial-question unanswered' },
    el(
      'div',
      { class: 'ask' },
      el('em', { text: String(number).padStart(2, '0') }),
      el('span', { text: question.text })
    )
  );

  const buttons = choices.map((choice, position) =>
    el(
      'button',
      {
        class: 'rune-choice',
        title: choice.label,
        onclick: () => {
          answers.set(question.key, choice.value);
          for (const button of buttons) button.classList.remove('on');
          buttons[position].classList.add('on');
          row.classList.remove('unanswered');
          retally();
        },
      },
      glyph(RUNES[position % RUNES.length]),
      el('span', { text: choice.label })
    )
  );

  row.append(el('div', { class: 'rune-scale' }, buttons));
  return row;
}

function openReport(attempt, closeLabel) {
  openModal({
    title: t('test.result'),
    subtitle: formatDateTime(attempt.taken_at),
    width: '720px',
    content: verdict(attempt).concat(breakdown(attempt)),
    actions: [el('button', { class: 'btn primary', text: closeLabel, onclick: closeModal })],
  });
}

function verdict(attempt) {
  const blocks = [
    el(
      'div',
      { class: 'trial-verdict' },
      el('b', { text: String(attempt.score) }),
      el('span', { class: 'muted', text: `/ ${attempt.max_score}` }),
      el('div', { class: 'band' }, el('strong', { text: attempt.band_title }))
    ),
  ];

  if (attempt.alarm) {
    blocks.push(
      el(
        'div',
        { class: 'trial-alarm' },
        el('strong', { text: t('test.alarm') }),
        el('span', { text: attempt.alarm })
      )
    );
  }

  if (attempt.note) {
    blocks.push(el('p', { class: 'muted', style: { margin: '0' }, text: attempt.note }));
  }

  return blocks;
}

function breakdown(attempt) {
  const blocks = [
    el('div', { class: 'section-title' }, el('span', { text: t('test.byParts') })),
    el(
      'div',
      { class: 'list' },
      attempt.sections.map((section) =>
        el(
          'div',
          { class: 'list-item' },
          el(
            'div',
            { class: 'title' },
            el('div', { text: section.title }),
            el('small', {
              text: t('test.score', { score: section.score, max: section.max_score }),
            })
          ),
          el(
            'div',
            { class: 'meter', style: { flex: '0 0 140px' } },
            el('i', { style: { width: `${(section.score / (section.max_score || 1)) * 100}%` } })
          )
        )
      )
    ),
    el('div', { class: 'section-title' }, el('span', { text: t('test.answers') })),
  ];

  for (const section of attempt.sections) {
    blocks.push(el('div', { class: 'section-title sub' }, el('span', { text: section.title })));
    blocks.push(
      el(
        'div',
        { class: 'list' },
        section.answers.map((answer) =>
          el(
            'div',
            { class: 'list-item' },
            el(
              'div',
              { class: 'title' },
              el('div', { text: answer.question }),
              el('small', { text: answer.label })
            ),
            el('b', { class: 'answer-mark', text: String(answer.value) })
          )
        )
      )
    );
  }

  return blocks;
}

function chart(attempts, summary) {
  const width = 720;
  const height = 260;
  const pad = { left: 34, right: 16, top: 12, bottom: 26 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const ceiling = summary.max_score || 1;

  const times = attempts.map((attempt) => new Date(attempt.taken_at).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);

  const across = (index) => {
    if (attempts.length === 1) return pad.left + plotWidth / 2;
    const share = last > first ? (times[index] - first) / (last - first) : index / (attempts.length - 1);
    return pad.left + share * plotWidth;
  };
  const up = (score) => pad.top + plotHeight - (score / ceiling) * plotHeight;

  const zones = summary.bands.map((band, index) => {
    const top = up(Math.min(band.high, ceiling));
    const bottom = up(band.low);
    return el(
      'rect',
      {
        class: `zone${index >= summary.bands.length / 2 ? ' heavy' : ''}`,
        x: pad.left,
        y: top,
        width: plotWidth,
        height: Math.max(1, bottom - top),
        'fill-opacity': (0.04 + index * 0.026).toFixed(3),
      },
      el('title', { text: `${band.title} · ${band.low}—${band.high}` })
    );
  });

  const points = attempts.map((attempt, index) => ({
    attempt,
    cx: across(index),
    cy: up(attempt.score),
  }));

  const trail =
    points.length > 1
      ? el('polyline', {
          class: 'trail',
          points: points.map((point) => `${point.cx.toFixed(1)},${point.cy.toFixed(1)}`).join(' '),
        })
      : null;

  const marks = points.map((point) =>
    el(
      'circle',
      {
        class: `mark${point.attempt.alarming ? ' alarming' : ''}`,
        cx: point.cx.toFixed(1),
        cy: point.cy.toFixed(1),
        r: 4.5,
      },
      el('title', {
        text: `${formatDate(point.attempt.taken_at)} · ${t('test.score', {
          score: point.attempt.score,
          max: point.attempt.max_score,
        })} · ${point.attempt.band_title}`,
      })
    )
  );

  const frame = [
    el('line', { class: 'rule', x1: pad.left, y1: up(0), x2: width - pad.right, y2: up(0) }),
    el('text', { x: 4, y: up(ceiling) + 8, text: String(ceiling) }),
    el('text', { x: 4, y: up(0), text: '0' }),
    el('text', {
      class: 'tick',
      x: pad.left,
      y: height - 8,
      text: formatDate(attempts[0].taken_at),
    }),
  ];

  if (attempts.length > 1) {
    frame.push(
      el('text', {
        class: 'tick',
        x: width - pad.right,
        y: height - 8,
        'text-anchor': 'end',
        text: formatDate(attempts[attempts.length - 1].taken_at),
      })
    );
  }

  return el(
    'svg',
    { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' },
    zones,
    frame,
    trail,
    marks
  );
}

function tally(answers) {
  let total = 0;
  for (const value of answers.values()) total += value;
  return total;
}
