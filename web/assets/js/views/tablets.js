import { api } from '../core/api.js';
import { basisField } from '../core/basis.js';
import { el, emptyState, iconPlate, mount } from '../core/dom.js';
import { formatDateTime } from '../core/format.js';
import { language, t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { focusEntity, focusTarget } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

const SAVE_DELAY = 700;
const MAX_COLUMNS = 12;
const MIN_CELL = 38;
const MAX_CELL = 420;
const STEP = 64;

let lastKindId = null;
let lastPageId = null;
let shelfFolded = false;

export async function renderTablets(container, params = {}) {
  await loadMedia();
  const kinds = await api.tabletKinds();
  const focus = focusTarget(params);
  const reload = (extra = {}) => renderTablets(container, extra);

  if (!kinds.length) {
    setHeader(t('nav.tablets'), t('tab.subtitleEmpty'), [
      el('button', {
        class: 'btn primary',
        text: t('tab.firstKind'),
        onclick: () => kindForm(null, () => reload()),
      }),
    ]);
    mount(container, emptyState(t('tab.emptyTitle'), t('tab.emptyHint')));
    return;
  }

  const wanted = await resolveTarget(focus, params);
  let kind = kinds.find((item) => item.id === wanted.kindId) || kinds[0];
  let pages = [];
  let page = null;
  let rows = [];
  let saveTimer = null;
  let pending = false;

  const shelf = el('div', { class: 'stack tablet-shelf' });
  const stage = el('div', { class: 'stack tablet-stage' });
  const status = el('span', { class: 'muted tablet-status' });
  const board = el('div', { class: boardClass() }, shelf, stage);
  let scroller = null;

  mount(container, board);
  container.classList.add('tablets-view');

  const onResize = () => growAll();
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  container.addEventListener(
    'view:teardown',
    () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      container.classList.remove('tablets-view');
      flush();
    },
    { once: true }
  );

  drawHeader();
  drawShelf();
  await selectKind(kind.id, wanted.pageId);
  focusEntity(container, params);

  function drawHeader() {
    setHeader(t('nav.tablets'), t('tab.subtitle'), [
      el('button', {
        class: 'btn ghost',
        text: t('tab.export'),
        onclick: (event) => exportTablets(event.target),
      }),
      el('button', {
        class: 'btn',
        text: t('tab.newKind'),
        onclick: () => kindForm(null, (made) => reload({ kindId: made.id })),
      }),
      el('button', {
        class: 'btn primary',
        text: t('tab.newPage'),
        disabled: !kind.columns.length,
        onclick: () => pageForm(null, (made) => reload({ kindId: kind.id, pageId: made.id })),
      }),
    ]);
  }

  function boardClass() {
    return `tablets-board${shelfFolded ? ' folded' : ''}`;
  }

  function foldButton() {
    return el('button', {
      class: 'btn sm ghost tablet-fold',
      text: shelfFolded ? '⟩' : '⟨',
      title: shelfFolded ? t('tab.unfoldShelf') : t('tab.foldShelf'),
      onclick: () => {
        shelfFolded = !shelfFolded;
        board.className = boardClass();
        drawShelf();
        growAll();
      },
    });
  }

  function drawShelf() {
    if (shelfFolded) {
      mount(shelf, foldButton());
      return;
    }
    mount(
      shelf,
      el(
        'div',
        { class: 'row between' },
        el('h3', { class: 'shelf-title', text: t('tab.kinds') }),
        foldButton()
      ),
      kinds.map((item) =>
        el(
          'div',
          {
            class: `card tablet-kind${item.id === kind.id ? ' on' : ''}`,
            dataset: { entity: `tablet_kind:${item.id}` },
            onclick: (event) => {
              if (event.target.closest('button')) return;
              selectKind(item.id, null);
            },
          },
          el(
            'div',
            { class: 'card-head' },
            iconPlate(item.icon, 'sm'),
            el(
              'div',
              { class: 'card-title' },
              el('strong', { text: item.title }),
              el('small', {
                text: [
                  t('tab.columnCount', { count: item.columns.length }),
                  t('tab.pageCount', { count: item.page_count }),
                ].join(' · '),
              })
            )
          ),
          item.summary ? el('p', { class: 'muted card-body', text: item.summary }) : null,
          el(
            'div',
            { class: 'card-foot' },
            el('button', {
              class: 'btn sm ghost',
              text: t('common.links'),
              onclick: () => openLinks('tablet_kind', item.id, item.title),
            }),
            el('button', {
              class: 'btn sm ghost',
              text: t('common.edit'),
              onclick: () => kindForm(item, () => reload({ kindId: item.id })),
            }),
            el('button', {
              class: 'btn sm ghost danger',
              text: '✕',
              title: t('tab.dropKind'),
              onclick: () => removeKind(item),
            })
          )
        )
      )
    );
  }

  async function selectKind(kindId, preferredPageId) {
    await flush();
    kind = kinds.find((item) => item.id === kindId) || kinds[0];
    lastKindId = kind.id;
    pages = await api.tabletPages(kind.id);
    drawHeader();
    drawShelf();
    const wanted = pages.some((item) => item.id === preferredPageId)
      ? preferredPageId
      : pages.length
        ? pages[0].id
        : null;
    await openPage(wanted);
  }

  async function openPage(pageId) {
    await flush();
    if (!kind.columns.length) {
      page = null;
      mount(stage, emptyState(t('tab.noColumns'), t('tab.noColumnsHint')));
      return;
    }
    if (!pageId) {
      page = null;
      mount(
        stage,
        emptyState(
          t('tab.noPages'),
          t('tab.noPagesHint'),
          el('button', {
            class: 'btn primary',
            text: t('tab.newPage'),
            onclick: () => pageForm(null, (made) => reload({ kindId: kind.id, pageId: made.id })),
          })
        )
      );
      return;
    }
    page = await api.tabletPage(pageId);
    lastPageId = page.id;
    rows = page.rows.map((row) => ({ id: row.id, cells: { ...row.cells } }));
    status.textContent = t('tab.saved', { when: formatDateTime(page.updated_at) });
    scroller = null;
    drawPage();
  }

  function drawPage() {
    const index = pages.findIndex((item) => item.id === page.id);
    const keptTop = scroller ? scroller.scrollTop : 0;
    const grid = el('div', { class: 'tablet-scroll', tabindex: '0' });
    scroller = grid;

    mount(
      stage,
      el(
        'article',
        { class: 'card tablet', dataset: { entity: `tablet_page:${page.id}` } },
        el(
          'div',
          { class: 'tablet-pager' },
          el('button', {
            class: 'btn sm',
            text: '‹',
            title: t('tab.prevPage'),
            disabled: index <= 0,
            onclick: () => openPage(pages[index - 1].id),
          }),
          el(
            'select',
            {
              class: 'tablet-picker',
              onchange: (event) => openPage(Number(event.target.value)),
            },
            pages.map((item) =>
              el('option', {
                value: String(item.id),
                text: item.title,
                selected: item.id === page.id,
              })
            )
          ),
          el('button', {
            class: 'btn sm',
            text: '›',
            title: t('tab.nextPage'),
            disabled: index >= pages.length - 1,
            onclick: () => openPage(pages[index + 1].id),
          }),
          el('span', {
            class: 'muted',
            text: t('tab.pageOf', { index: index + 1, total: pages.length }),
          }),
          el('span', { class: 'tablet-gap' }),
          el('button', {
            class: 'btn sm ghost',
            text: t('common.links'),
            onclick: () => openLinks('tablet_page', page.id, page.title),
          }),
          el('button', {
            class: 'btn sm',
            text: t('common.edit'),
            onclick: () => pageForm(page, () => reload({ kindId: kind.id, pageId: page.id })),
          }),
          el('button', {
            class: 'btn sm ghost danger',
            text: '✕',
            title: t('tab.dropPage'),
            onclick: () => removePage(page),
          })
        ),
        el(
          'div',
          { class: 'tablet-head' },
          el('span', { class: 'kicker', text: kind.title }),
          el('h2', { text: page.title }),
          page.purpose
            ? el('p', { class: 'muted', text: page.purpose, title: page.purpose })
            : null
        ),
        grid,
        el(
          'div',
          { class: 'tablet-foot' },
          el('button', { class: 'btn sm', text: t('tab.addRow'), onclick: addRow }),
          el('span', { class: 'muted', text: t('tab.rowCount', { count: rows.length }) }),
          status
        )
      )
    );

    drawGrid(grid);
    grid.scrollTop = keptTop;
  }

  function drawGrid(grid) {
    const head = el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { class: 'tablet-index', text: '#' }),
        kind.columns.map((column) => el('th', { text: column.title })),
        el('th', { class: 'tablet-index' })
      )
    );

    const body = el(
      'tbody',
      {},
      rows.map((row, index) =>
        el(
          'tr',
          {},
          el('td', { class: 'tablet-index', text: String(index + 1) }),
          kind.columns.map((column, place) =>
            el(
              'td',
              {},
              el('textarea', {
                rows: 1,
                value: row.cells[column.id] || '',
                dataset: { row: String(index), col: String(place) },
                oninput: (event) => {
                  row.cells[column.id] = event.target.value;
                  grow(event.target);
                  schedule();
                },
                onkeydown: (event) => walk(event),
              })
            )
          ),
          el(
            'td',
            { class: 'tablet-index' },
            el('button', {
              class: 'btn sm ghost danger',
              text: '✕',
              title: t('tab.dropRow'),
              onclick: () => dropRow(index),
            })
          )
        )
      )
    );

    mount(grid, el('table', { class: 'tablet-grid' }, head, body));
    growAll();
  }

  function grow(node) {
    node.style.height = 'auto';
    node.style.height = `${Math.min(Math.max(node.scrollHeight, MIN_CELL), MAX_CELL)}px`;
    node.classList.toggle('brimming', node.scrollHeight > MAX_CELL);
  }

  function growAll() {
    if (!scroller) return;
    for (const node of scroller.querySelectorAll('textarea')) grow(node);
  }

  function cellAt(rowIndex, columnIndex) {
    if (!scroller) return null;
    return scroller.querySelector(`textarea[data-row="${rowIndex}"][data-col="${columnIndex}"]`);
  }

  function walk(event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const node = event.target;
    const atStart = node.selectionStart === 0 && node.selectionEnd === 0;
    const atEnd =
      node.selectionStart === node.value.length && node.selectionEnd === node.value.length;
    if (event.key === 'ArrowUp' && !atStart) return;
    if (event.key === 'ArrowDown' && !atEnd) return;

    const rowIndex = Number(node.dataset.row) + (event.key === 'ArrowDown' ? 1 : -1);
    const neighbour = cellAt(rowIndex, Number(node.dataset.col));
    if (!neighbour) return;
    event.preventDefault();
    neighbour.focus();
    neighbour.setSelectionRange(neighbour.value.length, neighbour.value.length);
    neighbour.scrollIntoView({ block: 'nearest' });
  }

  function onKey(event) {
    if (!scroller || document.querySelector('.modal-root.open')) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select')) return;

    const jumps = {
      ArrowDown: STEP,
      ArrowUp: -STEP,
      PageDown: scroller.clientHeight * 0.9,
      PageUp: -scroller.clientHeight * 0.9,
    };
    if (event.key in jumps) {
      event.preventDefault();
      scroller.scrollBy({ top: jumps[event.key], behavior: 'smooth' });
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      scroller.scrollTo({
        top: event.key === 'Home' ? 0 : scroller.scrollHeight,
        behavior: 'smooth',
      });
    }
  }

  function addRow() {
    rows.push({ id: null, cells: {} });
    drawPage();
    schedule();
  }

  function dropRow(index) {
    rows.splice(index, 1);
    drawPage();
    schedule();
  }

  function schedule() {
    pending = true;
    status.textContent = t('tab.saving');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(commit, SAVE_DELAY);
  }

  async function flush() {
    window.clearTimeout(saveTimer);
    if (pending) await commit();
  }

  async function commit() {
    if (!page) return;
    const target = page.id;
    const payload = { rows: rows.map((row) => ({ id: row.id, cells: row.cells })) };
    pending = false;
    try {
      const saved = await api.saveTabletPage(target, payload);
      if (page && page.id === target) {
        saved.rows.forEach((row, index) => {
          if (rows[index]) rows[index].id = row.id;
        });
        page.updated_at = saved.updated_at;
        status.textContent = t('tab.saved', { when: formatDateTime(saved.updated_at) });
      }
    } catch (error) {
      pending = true;
      status.textContent = t('tab.saveFailed');
      toast(t('tab.saveFailed'), error.message, { tone: 'warn' });
    }
  }

  async function removeKind(item) {
    const yes = await confirmAction({
      title: t('tab.dropKindTitle'),
      message: t('tab.dropKindText', { name: item.title }),
      hint: t('tab.dropKindHint', { count: item.page_count }),
    });
    if (!yes) return;
    await api.deleteTabletKind(item.id);
    if (lastKindId === item.id) lastKindId = null;
    lastPageId = null;
    toast(t('tab.kindDropped'), item.title);
    await reload();
  }

  async function removePage(item) {
    const yes = await confirmAction({
      title: t('tab.dropPageTitle'),
      message: t('tab.dropPageText', { name: item.title }),
    });
    if (!yes) return;
    pending = false;
    window.clearTimeout(saveTimer);
    await api.deleteTabletPage(item.id);
    lastPageId = null;
    toast(t('tab.pageDropped'), item.title);
    await reload({ kindId: kind.id });
  }

  function ownColumns(draft) {
    if (!draft) return null;
    return { ...draft, columns: draft.columns.map((column) => ({ title: column.title })) };
  }

  function kindForm(item, onDone) {
    const editing = Boolean(item?.id);
    formModal({
      title: editing ? t('tab.kindForm') : t('tab.newKind'),
      subtitle: t('tab.columnsHint'),
      fields: [
        editing
          ? null
          : basisField(kinds, item?.basis, (draft) => kindForm(ownColumns(draft), onDone)),
        { name: 'title', label: t('tab.kindTitle'), value: item?.title || '' },
        {
          name: 'summary',
          label: t('tab.kindAbout'),
          type: 'textarea',
          rows: 3,
          value: item?.summary || '',
        },
        {
          name: 'columns',
          label: t('tab.columns'),
          type: 'columns',
          max: MAX_COLUMNS,
          value: item?.columns || [],
        },
        {
          name: 'icon_id',
          label: t('common.icon'),
          type: 'media',
          kind: 'image',
          value: item?.icon_id ?? null,
        },
      ],
      onSubmit: async (values) => {
        if (!values.title.trim()) throw new Error(t('common.titleRequired'));
        if (!values.columns.length) throw new Error(t('tab.columnsRequired'));
        const saved = editing
          ? await api.updateTabletKind(item.id, values)
          : await api.createTabletKind(values);
        toast(t('tab.kindSaved'), saved.title);
        await onDone(saved);
      },
    });
  }

  function pageForm(item, onDone) {
    formModal({
      title: item ? t('tab.pageForm') : t('tab.newPage'),
      subtitle: kind.title,
      fields: [
        { name: 'title', label: t('tab.pageTitle'), value: item?.title || '' },
        {
          name: 'purpose',
          label: t('tab.purpose'),
          type: 'textarea',
          rows: 3,
          help: t('tab.purposeHint'),
          value: item?.purpose || '',
        },
      ],
      onSubmit: async (values) => {
        if (!values.title.trim()) throw new Error(t('common.titleRequired'));
        await flush();
        const saved = item
          ? await api.saveTabletPage(item.id, values)
          : await api.createTabletPage({ ...values, kind_id: kind.id });
        toast(t('tab.pageSaved'), saved.title);
        await onDone(saved);
      },
    });
  }

}

async function resolveTarget(focus, params) {
  if (focus && focus.kind === 'tablet_page') {
    try {
      const found = await api.tabletPage(focus.id);
      return { kindId: found.kind_id, pageId: found.id };
    } catch (error) {
      void error;
    }
  }
  if (focus && focus.kind === 'tablet_kind') return { kindId: focus.id, pageId: null };
  return {
    kindId: Number(params.kindId) || lastKindId,
    pageId: Number(params.pageId) || lastPageId,
  };
}

async function exportTablets(button) {
  button.disabled = true;
  try {
    const result = await api.exportTablets(language());
    if (!result.files.length) {
      toast(t('tab.exportEmpty'), t('tab.emptyTitle'), { tone: 'warn' });
      return;
    }
    toast(
      t('tab.exported'),
      t('tab.exportWhere', { count: result.files.length, path: result.directory })
    );
  } catch (error) {
    toast(t('common.failed'), error.message, { tone: 'warn' });
  } finally {
    button.disabled = false;
  }
}
