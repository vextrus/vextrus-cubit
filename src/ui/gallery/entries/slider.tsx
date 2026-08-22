/** Slider — one thumb, two thumbs, and the rail that answers neither (§5). */
import { Slider } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** Sheet opacity, as a percentage: the primitive's own default bounds. */
const OPACITY = 60;
const OPACITY_MIN = 0;
const OPACITY_MAX = 100;

/** Storeys, from the ground to the roof of the sample building. */
const STOREY_MIN = 0;
const STOREY_MAX = 12;
const STOREYS: readonly number[] = [2, 7];

const single = (): string => gs('gallery.sample.slider.single');

export const entry: GalleryEntry = {
  id: 'slider',
  covers: ['Slider'],
  states: [
    {
      name: 'single',
      render: () => (
        <Slider
          aria-label={single()}
          defaultValue={OPACITY}
          min={OPACITY_MIN}
          max={OPACITY_MAX}
        />
      ),
    },
    {
      name: 'range',
      render: () => (
        <Slider
          aria-label={gs('gallery.sample.slider.range')}
          defaultValue={STOREYS}
          min={STOREY_MIN}
          max={STOREY_MAX}
        />
      ),
    },
    {
      name: 'disabled',
      render: () => (
        <Slider
          disabled
          aria-label={single()}
          defaultValue={OPACITY}
          min={OPACITY_MIN}
          max={OPACITY_MAX}
        />
      ),
    },
  ],
};
