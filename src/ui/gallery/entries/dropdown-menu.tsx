/** DropdownMenu — the acts a sheet offers, one of them destructive (§5). Drawn closed. */
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
          <DropdownMenuTrigger asChild>
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
