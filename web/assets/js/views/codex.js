import { api } from '../core/api.js';
import { clear, confirmDialog, el, mount } from '../core/dom.js';
import { formatDateTime, renderProse } from '../core/format.js';
import { openLinks } from '../core/links-ui.js';
import { formModal } from '../core/modal.js';
import { setHeader } from '../core/router.js';
import { loadMedia } from '../core/state.js';
import { toast } from '../core/toast.js';

let lastEntryId = null;

export async function renderCodex(container, params = {}) {
  container.dispatchEvent(new CustomEvent('view:teardown'));
  await loadMedia();
  const outline = await api.codexOutline();
  const order = flatten(outline);

  if (!order.length) {
    setHeader('Кодекс', 'Твой бестиарий и летопись', [
      el('button', { class: 'btn primary', text: 'Первая глава', onclick: () => chapterForm(null, outline, () => renderCodex(container)) }),
    ]);
    mount(
      container,
      el('div', { class: 'empty' }, el('h3', { text: 'Кодекс пуст' }), el('p', { text: 'Заведи главу — и начни записывать наблюдения.' }))
    );
    return;
  }

  let currentId = params.entryId || lastEntryId || order[0].id;
  if (!order.some((item) => item.id === currentId)) currentId = order[0].id;

  const nav = el('aside', { class: 'codex-nav' });
  const book = el('div', { class: 'book' });
  mount(container, el('div', { class: 'codex' }, nav, book));

  setHeader('Кодекс', 'Главы, страницы, наблюдения', [
    el('button', { class: 'btn', text: 'Новая глава', onclick: () => chapterForm(null, outline, () => renderCodex(container)) }),
    el('button', {
      class: 'btn primary',
      text: 'Новая страница',
      onclick: () => entryForm(null, order, outline, (entry) => renderCodex(container, { entryId: entry.id })),
    }),
  ]);

  const search = el('input', { type: 'search', placeholder: 'искать по кодексу' });
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
        : [el('p', { class: 'muted', style: { padding: '10px' }, text: 'Ничего не найдено' })]
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
          title: 'страница в главу',
          onclick: (event) => {
            event.stopPropagation();
            entryForm({ chapter_id: chapter.id }, order, outline, (entry) =>
              renderCodex(container, { entryId: entry.id })
            );
          },
        }),
        el('button', {
          class: 'btn ghost sm',
          text: '⚙',
          title: 'править главу',
          onclick: (event) => {
            event.stopPropagation();
            chapterForm(chapter, outline, () => renderCodex(container, { entryId: currentId }));
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
            text: 'Картинка',
            onclick: () => addImage(entry, () => drawPage(0)),
          }),
          el('button', {
            class: 'btn sm ghost',
            text: 'Связи',
            onclick: () => openLinks('codex_entry', entry.id, entry.title),
          }),
          el('button', {
            class: 'btn sm',
            text: 'Править',
            onclick: () => entryForm(entry, order, outline, () => renderCodex(container, { entryId: entry.id })),
          }),
          el('button', {
            class: 'btn sm ghost danger',
            text: '✕',
            onclick: async () => {
              if (!confirmDialog(`Вырвать страницу «${entry.title}»?`)) return;
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
                  if (!confirmDialog('Убрать картинку со страницы?')) return;
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
          text: '‹ назад',
          disabled: index <= 0,
          onclick: () => open(order[index - 1].id, -1),
        }),
        el('span', { text: `${index + 1} / ${order.length} · правлено ${formatDateTime(entry.updated_at)}` }),
        el('button', {
          class: 'btn sm ghost',
          text: 'вперёд ›',
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
  const result = [];
  for (const chapter of chapters) {
    result.push({ value: chapter.id, label: `${'— '.repeat(depth)}${chapter.title}` });
    result.push(...chapterOptions(chapter.children, depth + 1));
  }
  return result;
}

function chapterForm(chapter, outline, onDone) {
  formModal({
    title: chapter ? 'Правка главы' : 'Новая глава',
    fields: [
      { name: 'title', label: 'Название', value: chapter?.title || '' },
      { name: 'summary', label: 'О чём глава', type: 'textarea', rows: 3, value: chapter?.summary || '' },
      {
        name: 'parent_id',
        label: 'Вложить в главу',
        type: 'select',
        value: chapter?.parent_id ?? '',
        options: [{ value: null, label: '— корень —' }].concat(
          chapterOptions(outline).filter((option) => option.value !== chapter?.id)
        ),
      },
      { name: 'icon_id', label: 'Иконка', type: 'media', kind: 'image', value: chapter?.icon_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Название обязательно');
      if (chapter) await api.updateChapter(chapter.id, values);
      else await api.createChapter(values);
      await onDone();
    },
  });
}

function entryForm(entry, order, outline, onDone) {
  const isNew = !entry || !entry.id;
  formModal({
    title: isNew ? 'Новая страница' : 'Правка страницы',
    subtitle: 'Поддерживается **жирный**, _курсив_, ## заголовки, списки и > цитаты',
    fields: [
      {
        name: 'chapter_id',
        label: 'Глава',
        type: 'select',
        value: entry?.chapter_id ?? outline[0]?.id,
        options: chapterOptions(outline),
      },
      { name: 'title', label: 'Заголовок', value: entry?.title || '' },
      { name: 'body', label: 'Текст', type: 'textarea', rows: 14, value: entry?.body || '' },
      { name: 'cover_id', label: 'Обложка', type: 'media', kind: 'image', value: entry?.cover_id ?? null },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Заголовок обязателен');
      if (!values.chapter_id) throw new Error('Выбери главу');
      const saved = isNew ? await api.createEntry(values) : await api.updateEntry(entry.id, values);
      toast('Страница записана', saved.title);
      await onDone(saved);
    },
  });
}

function addImage(entry, onDone) {
  formModal({
    title: 'Картинка на страницу',
    fields: [{ name: 'media_id', label: 'Изображение', type: 'media', kind: 'image', value: null }],
    submitLabel: 'Вклеить',
    onSubmit: async (values) => {
      if (!values.media_id) throw new Error('Выбери изображение');
      const ids = entry.images.map((item) => item.id);
      if (!ids.includes(values.media_id)) ids.push(values.media_id);
      await api.updateEntry(entry.id, { image_ids: ids });
      await onDone();
    },
  });
}

function lightbox(url) {
  const node = el('div', { class: 'lightbox', onclick: () => node.remove() }, el('img', { src: url, alt: '' }));
  document.body.append(node);
}
