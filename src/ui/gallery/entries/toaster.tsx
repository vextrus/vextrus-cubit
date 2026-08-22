/** Toaster — the region a notification arrives in, and a button that sends one (§5). */
import { Button, Toaster, toast } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

const announce = (): void => {
  toast(gs('gallery.sample.toaster.message'));
};

export const entry: GalleryEntry = {
  id: 'toaster',
  covers: ['Toaster'],
  states: [
    {
      name: 'default',
      render: () => (
        <>
          <Button variant="secondary" onClick={announce}>
            {gs('gallery.sample.toaster.trigger')}
          </Button>
          <Toaster />
        </>
      ),
    },
  ],
};
