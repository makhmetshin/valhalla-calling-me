import { api } from './api.js';
import { el, mount } from './dom.js';
import { ENTITY_LABELS } from './format.js';
import { closeModal, openModal } from './modal.js';
import { toast } from './toast.js';

export async function openLinks(kind, id, label) {
  const [links, catalog] = await Promise.all([api.links(kind, id), api.linkCatalog()]);
  const list = el('div', { class: 'list' });

  const targetKind = el(
    'select',
    {},
    Object.keys(ENTITY_LABELS).map((key) =>
      el('option', { value: key, text: ENTITY_LABELS[key], selected: key === 'codex_entry' })
    )
  );
  const targetId = el('select', {});
  const note = el('input', { type: 'text', placeholder: 'зачем эта связь' });

  function fillTargets() {
    const options = (catalog[targetKind.value] || []).filter(
      (item) => !(targetKind.value === kind && item.id === id)
    );
    mount(
      targetId,
      options.length
        ? options.map((item) =>
            el('option', {
              value: String(item.id),
              text: item.detail ? `${item.label} — ${item.detail}` : item.label,
            })
          )
        : [el('option', { value: '', text: 'пусто' })]
    );
  }

  function renderList(items) {
    mount(
      list,
      items.length
        ? items.map((link) => {
            const other = link.source_kind === kind && link.source_id === id ? link.target : link.source;
            const otherKind = link.source_kind === kind && link.source_id === id
              ? link.target_kind
              : link.source_kind;
            return el(
              'div',
              { class: 'list-item' },
              el(
                'div',
                { class: 'title' },
                el('div', { text: other ? other.label : 'потеряно' }),
                el('small', { text: `${ENTITY_LABELS[otherKind]}${link.note ? ` · ${link.note}` : ''}` })
              ),
              el('button', {
                class: 'btn ghost sm',
                text: 'Разорвать',
                onclick: async () => {
                  await api.deleteLink(link.id);
                  renderList(await api.links(kind, id));
                },
              })
            );
          })
        : [el('div', { class: 'list-item' }, el('div', { class: 'title muted', text: 'Связей нет' }))]
    );
  }

  targetKind.onchange = fillTargets;
  fillTargets();
  renderList(links);

  openModal({
    title: 'Связи',
    subtitle: label,
    content: [
      list,
      el('div', { class: 'section-title', text: 'Новая связь' }),
      el(
        'div',
        { class: 'row wrap' },
        el('div', { style: { flex: '1 1 150px' } }, targetKind),
        el('div', { style: { flex: '2 1 220px' } }, targetId)
      ),
      note,
      el('button', {
        class: 'btn primary',
        text: 'Связать',
        onclick: async () => {
          if (!targetId.value) return;
          try {
            await api.createLink({
              source_kind: kind,
              source_id: id,
              target_kind: targetKind.value,
              target_id: Number(targetId.value),
              note: note.value,
            });
            note.value = '';
            renderList(await api.links(kind, id));
          } catch (error) {
            toast('Не связалось', error.message, { tone: 'warn' });
          }
        },
      }),
    ],
    actions: [el('button', { class: 'btn ghost', text: 'Закрыть', onclick: closeModal })],
  });
}
