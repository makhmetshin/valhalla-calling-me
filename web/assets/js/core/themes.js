import { el } from './dom.js';
import { t } from './i18n.js';
import { state } from './state.js';

export const THEMES = [
  {
    name: 'fjord',
    palette: {
      abyss: '5 8 12',
      deep: '9 14 20',
      panel: '17 26 37',
      sunken: '7 11 16',
      line: '29 42 56',
      ink: '200 214 229',
      'ink-strong': '238 244 250',
      muted: '112 131 153',
      steel: '159 182 205',
      accent: '111 159 200',
      'accent-soft': '169 200 228',
      danger: '168 85 90',
      shade: '3 5 8',
    },
  },
  {
    name: 'whaleroad',
    palette: {
      abyss: '3 12 14',
      deep: '5 18 21',
      panel: '10 30 34',
      sunken: '4 15 17',
      line: '22 54 58',
      ink: '190 219 218',
      'ink-strong': '231 248 245',
      muted: '98 138 140',
      steel: '146 188 188',
      accent: '62 166 162',
      'accent-soft': '132 214 205',
      danger: '178 96 78',
      shade: '1 8 10',
    },
  },
  {
    name: 'hearth',
    palette: {
      abyss: '15 11 8',
      deep: '21 15 11',
      panel: '34 25 19',
      sunken: '17 12 9',
      line: '60 44 33',
      ink: '231 214 194',
      'ink-strong': '250 240 224',
      muted: '151 126 102',
      steel: '201 178 150',
      accent: '201 133 61',
      'accent-soft': '236 186 117',
      danger: '174 78 62',
      shade: '9 6 4',
    },
  },
  {
    name: 'bloodsnow',
    palette: {
      abyss: '8 9 11',
      deep: '13 14 17',
      panel: '24 26 31',
      sunken: '10 11 13',
      line: '49 52 58',
      ink: '213 217 223',
      'ink-strong': '245 247 250',
      muted: '127 133 143',
      steel: '179 186 196',
      accent: '172 58 62',
      'accent-soft': '219 121 116',
      danger: '196 138 74',
      shade: '4 4 6',
    },
  },
  {
    name: 'aurora',
    palette: {
      abyss: '6 7 15',
      deep: '10 12 23',
      panel: '19 22 39',
      sunken: '8 9 18',
      line: '38 40 70',
      ink: '204 209 233',
      'ink-strong': '240 243 255',
      muted: '120 124 160',
      steel: '167 173 209',
      accent: '82 200 152',
      'accent-soft': '145 235 190',
      danger: '190 92 124',
      shade: '3 3 9',
    },
  },
  {
    name: 'ironwood',
    palette: {
      abyss: '7 11 8',
      deep: '11 17 12',
      panel: '20 30 22',
      sunken: '8 13 9',
      line: '41 57 41',
      ink: '205 219 201',
      'ink-strong': '238 246 231',
      muted: '116 138 114',
      steel: '165 189 159',
      accent: '137 168 86',
      'accent-soft': '195 216 136',
      danger: '172 90 68',
      shade: '4 7 4',
    },
  },
  {
    name: 'niflheim',
    palette: {
      abyss: '10 12 14',
      deep: '15 18 21',
      panel: '25 30 35',
      sunken: '12 14 16',
      line: '49 56 62',
      ink: '207 214 220',
      'ink-strong': '243 247 250',
      muted: '127 138 147',
      steel: '175 186 195',
      accent: '136 158 173',
      'accent-soft': '191 206 217',
      danger: '160 96 96',
      shade: '5 6 8',
    },
  },
  {
    name: 'saga',
    palette: {
      abyss: '224 213 191',
      deep: '235 226 207',
      panel: '246 239 223',
      sunken: '231 221 200',
      line: '189 170 137',
      ink: '63 51 38',
      'ink-strong': '30 22 14',
      muted: '124 105 80',
      steel: '92 76 57',
      accent: '150 84 38',
      'accent-soft': '104 55 24',
      danger: '148 50 40',
      shade: '58 43 26',
    },
  },
];

const ACCENT_TINT = 0.38;

export function themeTitle(theme) {
  return t(`theme.${theme.name}`);
}

export function themeHint(theme) {
  return t(`theme.${theme.name}Hint`);
}

export function themeByName(name) {
  return THEMES.find((theme) => theme.name === name) || THEMES[0];
}

export function activeTheme() {
  return themeByName(state.preferences['theme.palette']);
}

export function accentOverride() {
  const value = state.preferences['theme.accent'];
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '';
}

export function effectiveAccent() {
  return accentOverride() || toHex(activeTheme().palette.accent);
}

export function paletteOf(theme, accent = '') {
  if (!accent) return theme.palette;
  const triplet = toTriplet(accent);
  return {
    ...theme.palette,
    accent: triplet,
    'accent-soft': mix(triplet, theme.palette['ink-strong'], ACCENT_TINT),
  };
}

export function swatch(theme) {
  const palette = theme.palette;
  return el(
    'div',
    { class: 'swatch', style: { background: `rgb(${palette.deep})`, borderColor: `rgb(${palette.line})` } },
    el('i', { style: { background: `rgb(${palette.accent})` } }),
    el('i', { style: { background: `rgb(${palette['accent-soft']})` } }),
    el('i', { style: { background: `rgb(${palette.steel})` } }),
    el('i', { style: { background: `rgb(${palette.panel})` } })
  );
}

export function applyAppearance() {
  const heading = state.preferences['theme.font_heading'];
  const body = state.preferences['theme.font_body'];
  const palette = paletteOf(activeTheme(), accentOverride());
  const style = document.getElementById('userTheme') || el('style', { id: 'userTheme' });
  const rules = [];

  if (heading) {
    rules.push(`@font-face { font-family: "UserHead"; src: url("${heading}"); font-display: swap; }`);
  }
  if (body) {
    rules.push(`@font-face { font-family: "UserBody"; src: url("${body}"); font-display: swap; }`);
  }

  const tokens = Object.entries(palette).map(([key, value]) => `  --${key}-rgb: ${value};`);
  if (heading) tokens.push('  --font-head: "UserHead", Georgia, serif;');
  if (body) tokens.push('  --font-body: "UserBody", "Segoe UI", sans-serif;');
  rules.push(`:root {\n${tokens.join('\n')}\n}`);

  style.textContent = rules.join('\n');
  if (!style.isConnected) document.head.append(style);
}

function toHex(triplet) {
  return `#${channels(triplet)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function toTriplet(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(' ');
}

function mix(source, target, ratio) {
  const from = channels(source);
  const to = channels(target);
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio)).join(' ');
}

function channels(triplet) {
  return triplet.split(' ').map(Number);
}
