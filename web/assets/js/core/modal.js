import { api } from './api.js';
import { clear, el, mount } from './dom.js';
import { ENTITY_LABELS } from './format.js';
import { loadMedia, mediaById, mediaOfKind } from './state.js';
import { playUrl } from './audio.js';
import { toast } from './toast.js';

const root = document.getElementById('modalRoot');

export function closeModal() {
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

export function confirmAction({ title, message, confirmLabel = 'Стереть', hint }) {
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
          text: 'Отмена',
          onclick: () => {
            closeModal();
            finish(false);
          },
        }),
        el('button', {
          class: 'btn danger',
          text: confirmLabel,
          onclick: () => {
            closeModal();
            finish(true);
          },
        }),
      ],
    });
  });
}

export function formModal({ title, subtitle, fields, submitLabel = 'Сохранить', onSubmit }) {
  const controls = new Map();
  const nodes = fields.filter(Boolean).map((field) => {
    const control = buildControl(field);
    controls.set(field.name, control);
    return control.node;
  });

  const submit = el('button', { class: 'btn primary', text: submitLabel });
  const { modal } = openModal({
    title,
    subtitle,
    content: nodes,
    actions: [el('button', { class: 'btn ghost', text: 'Отмена', onclick: closeModal }), submit],
  });

  submit.onclick = async () => {
    const values = {};
    for (const [name, control] of controls) values[name] = control.read();
    submit.disabled = true;
    try {
      await onSubmit(values);
      closeModal();
    } catch (error) {
      toast('Не вышло', error.message, { tone: 'warn' });
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

function entityPicker(field) {
  const catalog = field.catalog || {};
  const kinds = Object.keys(ENTITY_LABELS).filter((kind) => (catalog[kind] || []).length);
  const current = field.value || {};

  const kindSelect = el(
    'select',
    {},
    [el('option', { value: '', text: '— ни к чему —' })].concat(
      kinds.map((kind) =>
        el('option', { value: kind, text: ENTITY_LABELS[kind], selected: kind === current.kind })
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
        : [el('option', { value: '', text: 'нечего выбрать' })]
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
  const kind = field.kind || 'image';
  let selected = field.value ?? null;

  const grid = el('div', { class: 'picker-grid' });
  const search = el('input', { type: 'search', placeholder: 'поиск по названию' });
  const file = el('input', {
    type: 'file',
    accept: kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : 'video/*',
    style: { display: 'none' },
  });
  const uploadButton = el('button', {
    class: 'btn sm',
    text: 'Загрузить',
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
      toast('Не удалось загрузить', error.message, { tone: 'warn' });
    } finally {
      uploadButton.disabled = false;
      file.value = '';
    }
  };

  function render() {
    const query = search.value.trim().toLowerCase();
    const assets = mediaOfKind(kind).filter(
      (asset) => !query || asset.title.toLowerCase().includes(query)
    );

    mount(
      grid,
      el('button', {
        class: `none${selected === null ? ' on' : ''}`,
        text: 'нет',
        title: 'Без изображения',
        onclick: (event) => {
          event.preventDefault();
          selected = null;
          render();
        },
      }),
      assets.map((asset) =>
        el(
          'button',
          {
            class: selected === asset.id ? 'on' : '',
            title: `${asset.title} (${asset.origin === 'preset' ? 'пресет' : 'своё'})`,
            onclick: (event) => {
              event.preventDefault();
              selected = asset.id;
              if (kind === 'audio') playUrl(asset.url);
              render();
            },
          },
          kind === 'image'
            ? el('img', { src: asset.url, alt: asset.title, loading: 'lazy' })
            : el('span', {
                class: 'muted',
                style: { fontSize: '10px', padding: '4px', display: 'block' },
                text: asset.title.slice(0, 18),
              })
        )
      )
    );
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
    toast('Пусто', emptyHint || 'Нечего выбирать', { tone: 'warn' });
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
    actions: [el('button', { class: 'btn ghost', text: 'Закрыть', onclick: closeModal })],
  });
}

export function mediaOption(id) {
  return mediaById(id);
}
