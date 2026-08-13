import { api } from '../core/api.js';
import { el, emptyState, mount } from '../core/dom.js';
import { formatBytes, formatDateTime } from '../core/format.js';
import { openLinks } from '../core/links-ui.js';
import { closeModal, formModal, openModal } from '../core/modal.js';
import {
  currentTrack,
  isPlaying,
  musicVolume,
  playTrack,
  playlist,
  refreshPlaylist,
  setMusicVolume,
  toggle,
} from '../core/player.js';
import { setHeader } from '../core/router.js';
import { loadMedia, mediaOfKind, on } from '../core/state.js';
import { toast } from '../core/toast.js';

export async function renderMusic(container) {
  container.dispatchEvent(new CustomEvent('view:teardown'));
  await Promise.all([loadMedia(), refreshPlaylist()]);
  const tracks = playlist();
  const reload = () => renderMusic(container);

  setHeader('Музыка', `${tracks.length} в списке`, [
    el('button', { class: 'btn', text: 'Из библиотеки', onclick: () => libraryModal(reload) }),
    el('button', { class: 'btn primary', text: 'Загрузить', onclick: () => upload(reload) }),
  ]);

  if (!tracks.length) {
    mount(
      container,
      volumeBlock(),
      emptyState(
        'Тишина в чертоге',
        'Загрузи свои файлы или положи их руками в vault/audio и нажми «Из библиотеки».',
        el('button', {
          class: 'btn primary',
          style: { marginTop: '14px' },
          text: 'Загрузить музыку',
          onclick: () => upload(reload),
        })
      )
    );
    return;
  }

  const list = el('div', { class: 'list' });
  const paint = () => mount(list, tracks.map((track, index) => row(track, index, tracks, reload)));
  paint();

  const off = on('player', paint);
  container.addEventListener('view:teardown', off, { once: true });

  mount(container, volumeBlock(), list);
}

function volumeBlock() {
  const slider = el('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    value: musicVolume(),
    style: { width: '100%' },
  });
  slider.oninput = () => setMusicVolume(Number(slider.value));

  return el(
    'div',
    { class: 'card', style: { marginBottom: '16px' } },
    el(
      'label',
      { class: 'field' },
      el('span', { text: 'Громкость музыки' }),
      slider,
      el('p', {
        class: 'muted',
        style: { margin: '6px 0 0' },
        text: 'Файлы лежат в vault/audio — их можно заменить руками, список переживёт переустановку.',
      })
    )
  );
}

function row(track, index, tracks, reload) {
  const active = currentTrack();
  const isCurrent = Boolean(active) && active.id === track.id;
  const playing = isCurrent && isPlaying();

  const meta = [
    track.play_count ? `сыграно ${track.play_count}` : 'ещё не звучала',
    track.last_played_at ? formatDateTime(track.last_played_at) : null,
    formatBytes(track.asset.size_bytes),
  ].filter(Boolean);

  const move = async (delta) => {
    const target = index + delta;
    if (target < 0 || target >= tracks.length) return;
    const ids = tracks.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.reorderTracks(ids);
    await reload();
  };

  return el(
    'div',
    { class: `list-item${isCurrent ? ' now' : ''}` },
    el('button', {
      class: `player-btn${playing ? ' main' : ''}`,
      title: playing ? 'Пауза' : 'Играть',
      text: playing ? '❚❚' : '▶',
      onclick: () => (isCurrent ? toggle() : playTrack(track.id)),
    }),
    el(
      'div',
      { class: 'title' },
      el('div', { text: track.title }),
      el('small', { text: [track.artist, meta.join(' · ')].filter(Boolean).join(' — ') })
    ),
    el('button', { class: 'btn sm ghost', text: '↑', onclick: () => move(-1) }),
    el('button', { class: 'btn sm ghost', text: '↓', onclick: () => move(1) }),
    el('button', {
      class: 'btn sm ghost',
      text: 'Связи',
      onclick: () => openLinks('track', track.id, track.title),
    }),
    el('button', { class: 'btn sm ghost', text: 'Править', onclick: () => trackForm(track, reload) }),
    el('button', { class: 'btn sm ghost danger', text: '✕', onclick: () => removeTrack(track, reload) })
  );
}

function trackForm(track, onDone) {
  formModal({
    title: 'Правка записи',
    fields: [
      { name: 'title', label: 'Название', value: track.title },
      { name: 'artist', label: 'Исполнитель', value: track.artist },
    ],
    onSubmit: async (values) => {
      if (!values.title.trim()) throw new Error('Название обязательно');
      await api.updateTrack(track.id, values);
      await onDone();
    },
  });
}

function removeTrack(track, onDone) {
  const drop = async (withFile) => {
    closeModal();
    try {
      await api.deleteTrack(track.id, withFile);
      await onDone();
    } catch (error) {
      toast('Не удалилось', error.message, { tone: 'warn' });
    }
  };

  openModal({
    title: 'Убрать запись',
    subtitle: track.title,
    content: [
      el('p', {
        class: 'muted',
        text: 'Можно убрать только из списка — файл останется в vault/audio и его можно вернуть.',
      }),
    ],
    actions: [
      el('button', { class: 'btn ghost', text: 'Отмена', onclick: closeModal }),
      el('button', { class: 'btn ghost danger', text: 'Вместе с файлом', onclick: () => drop(true) }),
      el('button', { class: 'btn primary', text: 'Только из списка', onclick: () => drop(false) }),
    ],
  });
}

function upload(onDone) {
  const input = el('input', { type: 'file', accept: 'audio/*', multiple: true });
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        await api.uploadTrack(file, file.name.replace(/\.[^.]+$/, ''));
        added += 1;
      } catch (error) {
        toast('Не загрузилось', `${file.name}: ${error.message}`, { tone: 'warn' });
      }
    }
    if (added) {
      await loadMedia(true);
      toast('В чертоге зазвучит', `добавлено: ${added}`);
      await onDone();
    }
  };
  input.click();
}

async function libraryModal(onDone) {
  const found = await api.scanVault();
  if (found.discovered) await loadMedia(true);

  const taken = new Set(playlist().map((track) => track.asset_id));
  const options = mediaOfKind('audio').filter((asset) => !taken.has(asset.id));

  if (!options.length) {
    toast('Пусто', 'Всё аудио из библиотеки уже в списке', { tone: 'warn' });
    return;
  }

  const chosen = new Set();
  const content = el(
    'div',
    { class: 'list' },
    options.map((asset) =>
      el(
        'label',
        { class: 'list-item', style: { cursor: 'pointer' } },
        el('input', {
          type: 'checkbox',
          style: { width: '16px', height: '16px', accentColor: 'var(--accent)' },
          onchange: (event) => {
            if (event.target.checked) chosen.add(asset.id);
            else chosen.delete(asset.id);
          },
        }),
        el(
          'div',
          { class: 'title' },
          el('div', { text: asset.title }),
          el('small', {
            text: `${asset.origin === 'preset' ? 'пресет' : 'своё'} · ${formatBytes(asset.size_bytes)}`,
          })
        )
      )
    )
  );

  const submit = el('button', { class: 'btn primary', text: 'Добавить' });
  openModal({
    title: 'Из библиотеки',
    subtitle: found.discovered
      ? `в vault/audio найдено новых файлов: ${found.discovered}`
      : 'аудио, которое уже лежит в хранилище',
    content: [content],
    actions: [el('button', { class: 'btn ghost', text: 'Отмена', onclick: closeModal }), submit],
  });

  submit.onclick = async () => {
    if (!chosen.size) return;
    submit.disabled = true;
    for (const assetId of chosen) {
      try {
        await api.createTrack({ asset_id: assetId });
      } catch (error) {
        toast('Не добавилось', error.message, { tone: 'warn' });
      }
    }
    closeModal();
    await onDone();
  };
}
