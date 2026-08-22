/** EvidenceLink — the way to what a claim rests on, named or naming itself (§5). */
import { EvidenceLink } from '../../patterns';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const HREF = '/design';

export const entry: GalleryEntry = {
  id: 'evidence-link',
  covers: ['EvidenceLink'],
  states: [
    { name: 'default', render: () => <EvidenceLink href={HREF} /> },
    {
      name: 'labelled',
      render: () => <EvidenceLink href={HREF}>{gs('gallery.sample.evidence-link.label')}</EvidenceLink>,
    },
  ],
};
