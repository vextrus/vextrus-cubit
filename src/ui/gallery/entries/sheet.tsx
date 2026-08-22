/** Sheet — the same modal, arriving from an edge (§5). Drawn closed. */
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'sheet',
  covers: ['Sheet', 'SheetClose', 'SheetContent', 'SheetTitle', 'SheetTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">{gs('gallery.sample.sheet.trigger')}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>{gs('gallery.sample.sheet.title')}</SheetTitle>
            {gs('gallery.sample.sheet.body')}
          </SheetContent>
        </Sheet>
      ),
    },
  ],
};
