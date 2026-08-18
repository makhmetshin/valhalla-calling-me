import { byLabel } from './format.js';
import { t } from './i18n.js';

export function basisField(samples, chosen, reopen) {
  if (!samples.length) return null;

  return {
    name: 'basis',
    label: t('common.basedOn'),
    help: t('common.basedOnHelp'),
    type: 'select',
    transient: true,
    value: chosen ?? '',
    options: [{ value: null, label: t('common.fromScratch') }].concat(
      byLabel(samples.map((sample) => ({ value: sample.id, label: nameOf(sample) })))
    ),
    onChange: (id) => {
      const sample = samples.find((item) => item.id === id);
      reopen(sample ? copyOf(sample) : null);
    },
  };
}

export function copyOf(sample) {
  const { id, ...rest } = sample;
  return { ...rest, basis: id };
}

function nameOf(sample) {
  return sample.title || sample.name || t('common.nameless');
}
