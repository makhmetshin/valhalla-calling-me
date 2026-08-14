import { api } from './api.js';
import { clear, el, mount } from './dom.js';
import { COLLECTION_KEYS, ENTITY_KINDS, collectionLabel, entityLabel } from './format.js';
import { t } from './i18n.js';
import { loadMedia, mediaById, mediaOfKind } from './state.js';
import { previewUrl, stopSound } from './audio.js';
import { toast } from './toast.js';

const root = document.getElementById('modalRoot');

export function closeModal() {
  stopSound();
  root.classList.remove('open');
  clear(root);
}

export function openModal({ title, subtitle, content, actions, width, onDismiss }) {
  const body = el('div', { class: 'modal-body' });
  const modal = el(
    'div',
    { class: 'modal', style: width ? { width } : {} },
    el(
      'header',
      {},
      el('h2', { text: title }),
      subtitle ? el('p', { class: 'muted', style: { margin: '6px 0 0' }, text: subtitle }) : null
    ),
    body,
    el('footer', {}, actions)
  );

  mount(body, content);
  mount(root, modal);
  root.classList.add('open');
  root.onclick = (event) => {
    if (event.target !== root) return;
    closeModal();
    if (onDismiss) onDismiss();
  };
  return { modal, body };
}

export function confirmAction({ title, message, confirmLabel, hint }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    openModal({
      title,
      subtitle: hint,
      content: [el('p', { text: message })],
      onDismiss: () => finish(false),
      actions: [
        el('button', {
          class: 'btn ghost',
          text: t('common.cancel'),
          onclick: () => {
            closeModal();
            finish(false);
          },
        }),
        el('button', {
          class: 'btn danger',
          text: confirmLabel || t('common.delete'),
          onclick: () => {
            closeModal();
            finish(true);
          },
        }),
      ],
    });
  });
}

export function formModal({ title, subtitle, fields, submitLabel, onSubmit }) {
  const controls = new Map();
  const nodes = fields.filter(Boolean).map((field) => {
    const control = buildControl(field);
    controls.set(field.name, control);
    return control.node;
  });

  const submit = el('button', { class: 'btn primary', text: submitLabel || t('common.save') });
  const { modal } = openModal({
    title,
    subtitle,
    content: nodes,
    actions: [el('button', { class: 'btn ghost', text: t('common.cancel'), onclick: closeModal }), submit],
  });

  submit.onclick = async () => {
    const values = {};
    for (const [name, control] of controls) values[name] = control.read();
    submit.disabled = true;
    try {
      await onSubmit(values);
      closeModal();
    } catch (error) {
      toast(t('common.failed'), error.message, { tone: 'warn' });
      submit.disabled = false;
    }
  };

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit.click();
  });
  const first = modal.querySelector('input, textarea, select');
  if (first) first.focus();
  return modal;
}

function labelled(field, control) {
  return el(
    'label',
    { class: 'field' },
    el('span', { text: field.label }),
    control,
    field.help ? el('p', { class: 'muted', style: { margin: '6px 0 0' }, text: field.help }) : null
  );
}

function buildControl(field) {
  switch (field.type) {
    case 'textarea': {
      const input = el('textarea', {
        value: field.value || '',
        placeholder: field.placeholder || '',
        rows: field.rows || 6,
      });
      return { node: labelled(field, input), read: () => input.value };
    }
    case 'number': {
      const input = el('input', {
        type: 'number',
        value: field.value ?? '',
        step: field.step ?? 'any',
        min: field.min ?? '',
        placeholder: field.placeholder || '',
      });
      return {
        node: labelled(field, input),
        read: () => (input.value === '' ? null : Number(input.value)),
      };
    }
    case 'select': {
      const select = el(
        'select',
        {},
        field.options.map((option) =>
          el('option', {
            value: String(option.value),
            text: option.label,
            selected: String(option.value) === String(field.value),
          })
        )
      );
      return {
        node: labelled(field, select),
        read: () => {
          const raw = select.value;
          if (raw === '') return null;
          const match = field.options.find((option) => String(option.value) === raw);
          return match ? match.value : raw;
        },
      };
    }
    case 'checkbox': {
      const input = el('input', { type: 'checkbox', checked: Boolean(field.value) });
      return {
        node: el('label', { class: 'check' }, input, el('span', { text: field.label })),
        read: () => input.checked,
      };
    }
    case 'media': {
      const picker = mediaPicker(field);
      return { node: labelled(field, picker.node), read: picker.read };
    }
    case 'entity': {
      const picker = entityPicker(field);
      return { node: labelled(field, picker.node), read: picker.read };
    }
    case 'columns': {
      const editor = columnEditor(field);
      return { node: labelled(field, editor.node), read: editor.read };
    }
    case 'date':
    case 'time':
    case 'datetime-local': {
      const input = el('input', { type: field.type, value: field.value || '' });
      return { node: labelled(field, input), read: () => input.value || null };
    }
    default: {
      const input = el('input', {
        type: 'text',
        value: field.value ?? '',
        placeholder: field.placeholder || '',
      });
      return { node: labelled(field, input), read: () => input.value };
    }
  }
}

function columnEditor(field) {
  const limit = field.max || 12;
  const rows = (field.value || []).map((column) => ({
    id: column.id ?? null,
    title: column.title || '',
  }));
  if (!rows.length) rows.push({ id: null, title: '' });

  const list = el('div', { class: 'stack', style: { gap: '6px' } });
  const add = el('button', {
    class: 'btn sm ghost',
    text: t('tab.addColumn'),
    onclick: (event) => {
      event.preventDefault();
      if (rows.length >= limit) return;
      rows.push({ id: null, title: '' });
      draw();
    },
  });

  function draw() {
    mount(
      list,
      rows.map((row, index) =>
        el(
          'div',
          { class: 'row', style: { gap: '6px' } },
          el('input', {
            type: 'text',
            value: row.title,
            placeholder: t('tab.columnName', { index: index + 1 }),
            style: { flex: '1 1 auto', minWidth: '0' },
            oninput: (event) => {
              row.title = event.target.value;
            },
          }),
          el('button', {
            class: 'btn sm ghost',
            text: '↑',
            title: t('tab.raiseColumn'),
            disabled: index === 0,
            onclick: (event) => {
              event.preventDefault();
              [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
              draw();
            },
          }),
          el('button', {
            class: 'btn sm ghost danger',
            text: '✕',
            title: t('tab.dropColumn'),
            disabled: rows.length < 2,
            onclick: (event) => {
              event.preventDefault();
              rows.splice(index, 1);
              draw();
            },
          })
        )
      ),
      add
    );
  }

  draw();
  return {
    node: list,
    read: () =>
      rows
        .map((row) => ({ id: row.id, title: row.title.trim() }))
        .filter((row) => row.title.length),
  };
}

function entityPicker(field) {
  const catalog = field.catalog || {};
  const kinds = ENTITY_KINDS.filter((kind) => (catalog[kind] || []).length);
  const current = field.value || {};

  const kindSelect = el(
    'select',
    {},
    [el('option', { value: '', text: t('common.notBound') })].concat(
      kinds.map((kind) =>
        el('option', { value: kind, text: entityLabel(kind), selected: kind === current.kind })
      )
    )
  );
  const itemSelect = el('select', {});

  function fillItems(preferredId) {
    const items = catalog[kindSelect.value] || [];
    itemSelect.disabled = !items.length;
    mount(
      itemSelect,
      items.length
        ? items.map((item) =>
            el('option', {
              value: String(item.id),
              text: item.detail ? `${item.label} — ${item.detail}` : item.label,
              selected: item.id === preferredId,
            })
          )
        : [el('option', { value: '', text: t('common.nothingToChoose') })]
    );
  }

  kindSelect.onchange = () => fillItems(null);
  fillItems(current.id ?? null);

  const node = el(
    'div',
    { class: 'row wrap', style: { gap: '8px' } },
    el('div', { style: { flex: '1 1 150px' } }, kindSelect),
    el('div', { style: { flex: '2 1 220px' } }, itemSelect)
  );

  return {
    node,
    read: () => {
      if (!kindSelect.value || !itemSelect.value) return null;
      return { kind: kindSelect.value, id: Number(itemSelect.value) };
    },
  };
}

function mediaPicker(field) {
  const kinds = Array.isArray(field.kind) ? field.kind : [field.kind || 'image'];
  let selected = field.value ?? null;

  const grid = el('div', { class: 'picker-body' });
  const search = el('input', { type: 'search', placeholder: t('common.search') });
  const file = el('input', {
    type: 'file',
    accept: kinds.map((name) => `${name}/*`).join(','),
    style: { display: 'none' },
  });
  const uploadButton = el('button', {
    class: 'btn sm',
    text: t('common.upload'),
    onclick: (event) => {
      event.preventDefault();
      file.click();
    },
  });

  file.onchange = async () => {
    const chosen = file.files[0];
    if (!chosen) return;
    uploadButton.disabled = true;
    try {
      const asset = await api.uploadMedia(chosen, chosen.name);
      await loadMedia(true);
      selected = asset.id;
      render();
    } catch (error) {
      toast(t('common.uploadFailed'), error.message, { tone: 'warn' });
    } finally {
      uploadButton.disabled = false;
      file.value = '';
    }
  };

  function tile(asset) {
    return el(
      'button',
      {
        class: selected === asset.id ? 'on' : '',
        title: `${asset.title} (${asset.origin === 'preset' ? t('common.preset') : t('common.own')})`,
        onclick: (event) => {
          event.preventDefault();
          selected = asset.id;
          if (asset.kind === 'audio') previewUrl(asset.url);
          render();
        },
      },
      asset.kind === 'image'
        ? el('img', { src: asset.url, alt: asset.title, loading: 'lazy' })
        : el('span', {
            class: 'muted',
            style: { fontSize: '10px', padding: '4px', display: 'block' },
            text: asset.title.slice(0, 18),
          })
    );
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const assets = kinds
      .flatMap((name) => mediaOfKind(name))
      .filter((asset) => !query || asset.title.toLowerCase().includes(query));

    const groups = new Map();
    for (const asset of assets) {
      const name = COLLECTION_KEYS.includes(asset.collection) ? asset.collection : 'uploads';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(asset);
    }

    const blank = el('button', {
      class: `none${selected === null ? ' on' : ''}`,
      text: t('common.none'),
      title: t('common.noImage'),
      onclick: (event) => {
        event.preventDefault();
        selected = null;
        render();
      },
    });

    const sections = [];
    for (const name of COLLECTION_KEYS) {
      const items = groups.get(name);
      if (!items) continue;
      const tiles = items.map(tile);
      if (!sections.length) tiles.unshift(blank);
      sections.push(
        el(
          'div',
          { class: 'picker-group' },
          el('span', { text: collectionLabel(name) }),
          el('span', { class: 'muted', text: items.length })
        ),
        el('div', { class: 'picker-grid' }, tiles)
      );
    }

    mount(grid, sections.length ? sections : [el('div', { class: 'picker-grid' }, blank)]);
  }

  search.oninput = render;
  render();

  const node = el(
    'div',
    { class: 'picker' },
    el('div', { class: 'picker-head' }, search, uploadButton, file),
    grid
  );
  return { node, read: () => selected };
}

export function pickFromList({ title, subtitle, options, onPick, emptyHint }) {
  if (!options.length) {
    toast(t('common.empty'), emptyHint || t('common.nothingToPick'), { tone: 'warn' });
    return;
  }
  const list = el(
    'div',
    { class: 'list' },
    options.map((option) =>
      el(
        'div',
        {
          class: 'list-item',
          style: { cursor: 'pointer' },
          onclick: () => {
            closeModal();
            onPick(option.value);
          },
        },
        el(
          'div',
          { class: 'title' },
          el('div', { text: option.label }),
          option.detail ? el('small', { text: option.detail }) : null
        )
      )
    )
  );
  openModal({
    title,
    subtitle,
    content: [list],
    actions: [el('button', { class: 'btn ghost', text: t('common.close'), onclick: closeModal })],
  });
}

export function mediaOption(id) {
  return mediaById(id);
}
