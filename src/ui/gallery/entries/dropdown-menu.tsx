/**
 * DropdownMenu — the acts a sheet offers, one of them destructive (§5). Drawn closed.
 *
 * The trigger is given its id here: Radix mints one with React's `useId`, which counts from a
 * module global and so differs between two renders of the same sheet, and it writes that id onto
 * the trigger before spreading the caller's props — so a named id overrides it and the closed
 * trigger's markup is the same drawing every time.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The tone a destructive item carries (primitives.css `.datum-menu-item[data-tone='danger']`). */
const DANGER = 'danger';

export const entry: GalleryEntry = {
  id: 'dropdown-menu',
  covers: [
    'DropdownMenu',
    'DropdownMenuContent',
    'DropdownMenuItem',
    'DropdownMenuTrigger',
  ],
  states: [
    {
      name: 'default',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild id="gallery-dropdown-menu-trigger">
            <Button variant="secondary">{gs('gallery.sample.dropdown-menu.trigger')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{gs('gallery.sample.dropdown-menu.rename')}</DropdownMenuItem>
            <DropdownMenuItem>{gs('gallery.sample.dropdown-menu.duplicate')}</DropdownMenuItem>
            <DropdownMenuItem data-tone={DANGER}>
              {gs('gallery.sample.dropdown-menu.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ],
};
