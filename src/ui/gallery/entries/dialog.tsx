/**
 * Dialog — the modal and its four parts (§5). Drawn closed.
 *
 * A permanently open modal would scrim the sheet and hide every other entry, so the trigger is
 * live and the visual-baseline increment scripts the open (Design Decision, interpretation 2).
 */
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
} from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

export const entry: GalleryEntry = {
  id: 'dialog',
  covers: [
    'Dialog',
    'DialogClose',
    'DialogContent',
    'DialogDescription',
    'DialogTitle',
    'DialogTrigger',
  ],
  states: [
    {
      name: 'default',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">{gs('gallery.sample.dialog.trigger')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{gs('gallery.sample.dialog.title')}</DialogTitle>
            <DialogDescription>{gs('gallery.sample.dialog.description')}</DialogDescription>
            <Input
              aria-label={gs('gallery.sample.input.name')}
              defaultValue={gs('gallery.sample.input.value')}
            />
          </DialogContent>
        </Dialog>
      ),
    },
  ],
};
