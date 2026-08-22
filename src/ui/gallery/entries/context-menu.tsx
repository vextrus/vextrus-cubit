/** ContextMenu — the same three acts, reached from the thing itself (§5). Drawn closed. */
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The tone a destructive item carries (primitives.css `.datum-menu-item[data-tone='danger']`). */
const DANGER = 'danger';

export const entry: GalleryEntry = {
  id: 'context-menu',
  covers: ['ContextMenu', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <ContextMenu>
          <ContextMenuTrigger className="datum-gallery-context-target">
            {gs('gallery.sample.context-menu.trigger')}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>{gs('gallery.sample.context-menu.rename')}</ContextMenuItem>
            <ContextMenuItem>{gs('gallery.sample.context-menu.duplicate')}</ContextMenuItem>
            <ContextMenuItem data-tone={DANGER}>
              {gs('gallery.sample.context-menu.delete')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
    },
  ],
};
