import { api } from '../core/api.js';
import { clear, el, emptyState, mount } from '../core/dom.js';
import { byLabel, formatDateTime, renderProse } from '../core/format.js';
import { language, t } from '../core/i18n.js';
import { openLinks } from '../core/links-ui.js';
import { confirmAction, formModal } from '../core/modal.js';
import { focusTarget } from '../core/navigation.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

let lastEntryId = null;

export async function renderCodex(container, params = {}) {
  container.dispatchEvent(new CustomEvent('view:teardown'));
  await loadMedia();
  const outline = await api.codexOutline();
  const order = flatten(outline);
  const focus = focusTarget(params);

  if (!outline.length) {
    setHeader(t('nav.codex'), t('codex.subtitleEmpty'), [
      el('button', { class: 'btn primary', text: t('codex.firstChapter'), onclick: () => chapterForm(null, outline, () => renderCodex(container)) }),
    ]);
    mount(container, emptyState(t('codex.emptyTitle'), t('codex.emptyHint')));
    return;
  }

  let currentId = order.length
    ? entryFor(focus, order) || params.entryId || lastEntryId || order[0].id
    : null;
  if (order.length && !order.some((item) => item.id === currentId)) currentId = order[0].id;

  const nav = el('aside', { class: 'codex-nav' });
  const book = el('div', { class: 'book' });
  mount(container, el('div', { class: 'codex' }, nav, book));

  setHeader(t('nav.codex'), t('codex.subtitle'), [
    el('button', {
      class: 'btn ghost',
      text: t('codex.export'),
      onclick: (event) => exportCodex(event.target),
    }),
    el('button', { class: 'btn', text: t('codex.newChapter'), onclick: () => chapterForm(null, outline, () => renderCodex(container)) }),
    el('button', {
      class: 'btn primary',
      text: t('codex.newEntry'),
      onclick: () => entryForm(null, outline, (entry) => renderCodex(container, { entryId: entry.id })),
    }),
  ]);

  const search = el('input', { type: 'search', placeholder: t('codex.search') });
  search.oninput = async () => {
    const query = search.value.trim();
    if (query.length < 2) {
      drawTree();
      return;
    }
    const found = await api.codexSearch(query);
    mount(
      nav.querySelector('.codex-tree'),
      found.length
        ? found.map((entry) =>
            el('button', {
              class: `entry${entry.id === currentId ? ' active' : ''}`,
              text: entry.title,
              onclick: () => open(entry.id, 1),
            })
          )
        : [el('p', { class: 'muted', style: { padding: '10px' }, text: t('codex.notFound') })]
    );
  };

  const tree = el('div', { class: 'codex-tree' });
  mount(nav, el('div', { class: 'nav-head' }, search), tree);

  function drawTree() {
    mount(tree, outline.map((chapter) => chapterNode(chapter)));
  }

  function chapterNode(chapter) {
    const children = el(
      'div',
      { class: 'chapter-children' },
      chapter.entries.map((entry) =>
        el('button', {
          class: `entry${entry.id === currentId ? ' active' : ''}`,
          text: entry.title,
          onclick: () => open(entry.id),
        })
      ),
      chapter.children.map((child) => chapterNode(child))
    );

    const node = el(
      'div',
      { class: 'chapter' },
      el(
        'div',
        { class: 'chapter-row' },
        el('span', { class: 'caret', text: '▾' }),
        el('span', { style: { flex: '1' }, text: chapter.title }),
        el('button', {
          class: 'btn ghost sm',
          text: '+',
          title: t('codex.addEntry'),
          onclick: (event) => {
            event.stopPropagation();
            entryForm({ chapter_id: chapter.id }, outline, (entry) =>
              renderCodex(container, { entryId: entry.id })
            );
          },
        }),
        el('button', {
          class: 'btn ghost sm',
          text: '⚙',
          title: t('codex.editChapter'),
          onclick: (event) => {
            event.stopPropagation();
            chapterForm(chapter, outline, () => renderCodex(container, { entryId: currentId }));
          },
        }),
        el('button', {
          class: 'btn ghost sm danger',
          text: '✕',
          title: t('codex.dropChapter'),
          onclick: async (event) => {
            event.stopPropagation();
            const yes = await confirmAction({
              title: t('codex.dropChapterTitle'),
              message: t('codex.dropChapterText', { name: chapter.title }),
              hint: chapterHint(chapter),
            });
            if (!yes) return;
            await api.deleteChapter(chapter.id);
            lastEntryId = null;
            toast(t('codex.chapterDropped'), chapter.title);
            renderCodex(container);
          },
        })
      ),
      children
    );

    node.querySelector('.chapter-row').addEventListener('click', (event) => {
      if (event.target.closest('button.btn')) return;
      node.classList.toggle('closed');
    });
    return node;
  }

  async function open(entryId, direction = 0) {
    const previousIndex = order.findIndex((item) => item.id === currentId);
    const nextIndex = order.findIndex((item) => item.id === entryId);
    currentId = entryId;
    lastEntryId = entryId;
    drawTree();
    await drawPage(direction || (nextIndex > previousIndex ? 1 : -1));
  }

  async function drawPage(direction = 0) {
    if (currentId === null) {
      mount(
        book,
        emptyState(
          t('codex.noPagesTitle'),
          t('codex.noPagesHint'),
          el('button', {
            class: 'btn primary',
            style: { marginTop: '14px' },
            text: t('codex.newEntry'),
            onclick: () => entryForm(null, outline, (saved) => renderCodex(container, { entryId: saved.id })),
          })
        )
      );
      return;
    }

    const entry = await api.entry(currentId);
    const index = order.findIndex((item) => item.id === currentId);
    const chapterTitle = order[index] ? order[index].chapterTitle : '';

    const page = el(
      'article',
      { class: 'page' },
      el(
        'div',
        { class: 'page-head' },
        el(
          'div',
          {},
          el('div', { class: 'kicker', text: chapterTitle }),
          el('h2', { text: entry.title })
        ),
        el(
          'div',
          { class: 'row' },
          el('button', {
            class: 'btn sm ghost',
            text: t('codex.image'),
            onclick: () => addImage(entry, () => drawPage(0)),
          }),
          el('button', {
            class: 'btn sm ghost',
            text: t('common.links'),
            onclick: () => openLinks('codex_entry', entry.id, entry.title),
          }),
          el('button', {
            class: 'btn sm',
            text: t('common.edit'),
            onclick: () => entryForm(entry, outline, () => renderCodex(container, { entryId: entry.id })),
          }),
          el('button', {
            class: 'btn sm ghost danger',
            text: '✕',
            title: t('codex.dropEntry'),
            onclick: async () => {
              const yes = await confirmAction({
                title: t('codex.dropEntryTitle'),
                message: t('codex.dropEntryText', { name: entry.title }),
              });
              if (!yes) return;
              await api.deleteEntry(entry.id);
              lastEntryId = null;
              renderCodex(container);
            },
          })
        )
      ),
      el('div', { class: 'page-prose', html: renderProse(entry.body) }),
      entry.images.length
        ? el(
            'div',
            { class: 'page-gallery' },
            entry.images.map((image) =>
              el('img', {
                src: image.url,
                alt: image.title,
                loading: 'lazy',
                onclick: () => lightbox(image.url),
                oncontextmenu: async (event) => {
                  event.preventDefault();
                  const yes = await confirmAction({
                    title: t('codex.dropImageTitle'),
                    message: t('codex.dropImageText'),
                    confirmLabel: t('common.remove'),
                  });
                  if (!yes) return;
                  await api.updateEntry(entry.id, {
                    image_ids: entry.images.filter((item) => item.id !== image.id).map((item) => item.id),
                  });
                  drawPage(0);
                },
              })
            )
          )
        : null,
      el(
        'div',
        { class: 'page-foot' },
        el('button', {
          class: 'btn sm ghost',
          text: t('codex.back'),
          disabled: index <= 0,
          onclick: () => open(order[index - 1].id, -1),
        }),
        el('span', {
          text: t('codex.pageFoot', {
            index: index + 1,
            total: order.length,
            when: formatDateTime(entry.updated_at),
          }),
        }),
        el('button', {
          class: 'btn sm ghost',
          text: t('codex.forward'),
          disabled: index >= order.length - 1,
          onclick: () => open(order[index + 1].id, 1),
        })
      )
    );

    clear(book);
    book.append(page);
    if (direction !== 0) {
      page.classList.add(direction > 0 ? 'turn-next' : 'turn-prev');
      page.addEventListener('animationend', () => page.classList.remove('turn-next', 'turn-prev'), {
        once: true,
      });
    }
  }

  const onKey = (event) => {
    if (document.querySelector('.modal-root.open')) return;
    if (event.target instanceof Element && event.target.closest('input, textarea')) return;
    const index = order.findIndex((item) => item.id === currentId);
    if (event.key === 'ArrowRight' && index < order.length - 1) open(order[index + 1].id, 1);
    if (event.key === 'ArrowLeft' && index > 0) open(order[index - 1].id, -1);
  };
  document.addEventListener('keydown', onKey);
  container.addEventListener('view:teardown', () => document.removeEventListener('keydown', onKey), {
    once: true,
  });

  drawTree();
  await drawPage(0);
}

function chapterWeight(chapter) {
  let chapters = 0;
  let entries = chapter.entries.length;
  for (const child of chapter.children) {
    const nested = chapterWeight(child);
    chapters += 1 + nested.chapters;
    entries += nested.entries;
  }
  return { chapters, entries };
}

function chapterHint(chapter) {
  const { chapters, entries } = chapterWeight(chapter);
  const parts = [t('codex.chapterWeight', { entries })];
  if (chapters) parts.unshift(t('codex.chapterNested', { chapters }));
  return parts.join(' · ');
}

function entryFor(focus, order) {
  if (!focus) return null;
  if (focus.kind === 'codex_entry') {
    return order.some((item) => item.id === focus.id) ? focus.id : null;
  }
  if (focus.kind === 'codex_chapter') {
    const first = order.find((item) => item.chapterId === focus.id);
    return first ? first.id : null;
  }
  return null;
}

function flatten(chapters, trail = []) {
  const result = [];
  for (const chapter of chapters) {
    const path = [...trail, chapter.title];
    for (const entry of chapter.entries) {
      result.push({ id: entry.id, title: entry.title, chapterId: chapter.id, chapterTitle: path.join(' / ') });
    }
    result.push(...flatten(chapter.children, path));
  }
  return result;
}

function chapterOptions(chapters, depth = 0) {
  return byLabel(chapters, (chapter) => chapter.title).flatMap((chapter) => [
    { value: chapter.id, label: `${'— '.repeat(depth)}${chapter.title}` },
    ...chapterOptions(chapter.children, depth + 1),
  ]);
}

function chapterForm(chapter, outline, onDone) {
  formModal({
    title: chapter ? t('codex.chapterForm') : t('codex.newChapter'),
    fields: [
      { name: 'title', label: t('common.title'), value: chapter?.title || '' },
      { name: 'summary', label: t('codex.chapterAbout'), type: 'textarea', rows: 3, value: chapter?.summary || '' },
      {
        name: 'parent_id',
        label: t('codex.nestInto'),
        type: 'select',
        value: chapter?.parent_id ?? '',
        options: [{ value: null, label: t('codex.root') }].concat(
          chapterOptions(outline).filter((option) => option.value !== chapter?.id)
        ),
      },
      { name: 'icon_id', label: t('common.icon'), type: 'media', kind: 'image', value: chapter?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('common.titleRequired'));
      if (chapter) await api.updateChapter(chapter.id, values);
      else await api.createChapter(values);
      await onDone();
    },
  });
}

function entryForm(entry, outline, onDone) {
  const isNew = !entry || !entry.id;
  formModal({
    title: isNew ? t('codex.newEntry') : t('codex.entryForm'),
    subtitle: t('codex.entryHint'),
    fields: [
      {
        name: 'chapter_id',
        label: t('codex.chapter'),
        type: 'select',
        value: entry?.chapter_id ?? outline[0]?.id,
        options: chapterOptions(outline),
      },
      { name: 'title', label: t('codex.entryTitle'), value: entry?.title || '' },
      { name: 'body', label: t('codex.entryBody'), type: 'textarea', rows: 14, value: entry?.body || '' },
      { name: 'cover_id', label: t('codex.cover'), type: 'media', kind: 'image', value: entry?.cover_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error(t('rem.headingRequired'));
      if (!values.chapter_id) throw new Error(t('codex.pickChapter'));
      const saved = isNew ? await api.createEntry(values) : await api.updateEntry(entry.id, values);
      toast(t('codex.entrySaved'), saved.title);
      await onDone(saved);
    },
  });
}

function addImage(entry, onDone) {
  formModal({
    title: t('codex.addImageTitle'),
    fields: [{ name: 'media_id', label: t('codex.imageField'), type: 'media', kind: 'image', value: null }],
    submitLabel: t('codex.addImageSubmit'),
    onSubmit: async (values) => {
      if (!values.media_id) throw new Error(t('codex.pickImage'));
      const ids = entry.images.map((item) => item.id);
      if (!ids.includes(values.media_id)) ids.push(values.media_id);
      await api.updateEntry(entry.id, { image_ids: ids });
      await onDone();
    },
  });
}

async function exportCodex(button) {
  button.disabled = true;
  try {
    const result = await api.exportCodex(language());
    toast(
      t('codex.exported'),
      t('tab.exportWhere', { count: result.files.length, path: result.directory })
    );
  } catch (error) {
    toast(t('common.failed'), error.message, { tone: 'warn' });
  } finally {
    button.disabled = false;
  }
}

function lightbox(url) {
  const node = el('div', { class: 'lightbox', onclick: () => node.remove() }, el('img', { src: url, alt: '' }));
  document.body.append(node);
}
