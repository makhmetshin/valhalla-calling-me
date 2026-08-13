const SVG_TAGS = new Set(['svg', 'path', 'circle', 'line', 'polygon', 'g']);

export function el(tag, props = {}, ...children) {
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.setAttribute('class', value);
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && !SVG_TAGS.has(tag)) node[key] = value;
    else node.setAttribute(key, value);
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  return append(node, children);
}

export function glyph(name, size = '') {
  const url = `url("/presets/glyphs/${name}.svg")`;
  return el('i', {
    class: `glyph${size ? ` ${size}` : ''}`,
    style: { maskImage: url, webkitMaskImage: url },
  });
}

export function iconPlate(media, size = '') {
  const cls = `icon-plate${size ? ` ${size}` : ''}`;
  if (!media) return el('div', { class: `${cls} blank` }, '✦');
  return el('div', { class: cls }, el('img', { src: media.url, alt: media.title, loading: 'lazy' }));
}

export function emptyState(title, hint, action) {
  return el('div', { class: 'empty' }, el('h3', { text: title }), el('p', { text: hint }), action);
}
