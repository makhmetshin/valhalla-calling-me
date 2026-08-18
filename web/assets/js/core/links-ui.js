import { api } from './api.js';
import { el, mount } from './dom.js';
import { ENTITY_KINDS, byLabel, entityLabel } from './format.js';
import { t } from './i18n.js';
import { closeModal, openModal } from './modal.js';
import { openEntity } from './navigation.js';
import { toast } from './toast.js';

export async function openLinks(kind, id, label) {
  const [links, catalog] = await Promise.all([api.links(kind, id), api.linkCatalog()]);
  const list = el('div', { class: 'list' });

  const targetKind = el(
    'select',
    {},
    ENTITY_KINDS.map((key) =>
      el('option', { value: key, text: entityLabel(key), selected: key === 'codex_entry' })
    )
  );
  const targetId = el('select', {});
  const note = el('input', { type: 'text', placeholder: t('links.note') });

  function fillTargets() {
    const options = byLabel(
      (catalog[targetKind.value] || []).filter(
        (item) => !(targetKind.value === kind && item.id === id)
      )
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
        : [el('option', { value: '', text: t('links.emptyKind') })]
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
                'button',
                {
                  class: 'title link-row',
                  title: t('common.goToIt'),
                  disabled: !other,
                  onclick: () => {
                    closeModal();
                    openEntity(otherKind, other.id);
                  },
                },
                el('div', { text: other ? other.label : t('links.lost') }),
                el('small', { text: `${entityLabel(otherKind)}${link.note ? ` · ${link.note}` : ''}` })
              ),
              el('button', {
                class: 'btn ghost sm',
                text: t('links.break'),
                onclick: async () => {
                  await api.deleteLink(link.id);
                  renderList(await api.links(kind, id));
                },
              })
            );
          })
        : [el('div', { class: 'list-item' }, el('div', { class: 'title muted', text: t('links.none') }))]
    );
  }

  targetKind.onchange = fillTargets;
  fillTargets();
  renderList(links);

  openModal({
    title: t('links.title'),
    subtitle: label,
    content: [
      list,
      el('div', { class: 'section-title', text: t('links.newLink') }),
      el(
        'div',
        { class: 'row wrap' },
        el('div', { style: { flex: '1 1 150px' } }, targetKind),
        el('div', { style: { flex: '2 1 220px' } }, targetId)
      ),
      note,
      el('button', {
        class: 'btn primary',
        text: t('links.bind'),
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
            toast(t('links.failed'), error.message, { tone: 'warn' });
          }
        },
      }),
    ],
    actions: [el('button', { class: 'btn ghost', text: t('common.close'), onclick: closeModal })],
  });
}
