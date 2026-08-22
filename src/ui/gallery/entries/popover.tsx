/** Popover — a panel of detail, anchored to what asked for it (§5). Drawn closed. */
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'popover',
  covers: ['Popover', 'PopoverContent', 'PopoverTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">{gs('gallery.sample.popover.trigger')}</Button>
          </PopoverTrigger>
          <PopoverContent aria-label={gs('gallery.sample.popover.trigger')}>
            {gs('gallery.sample.popover.body')}
          </PopoverContent>
        </Popover>
      ),
    },
  ],
};
