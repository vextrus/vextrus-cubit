/** Tooltip — a tip that waits for a rest or a focus, on a control that needs one (§5). */
import { Magnet } from 'lucide-react';
import { IconButton, Tooltip, TooltipContent, TooltipTrigger } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The glyph's box, in px: a layout dimension, not a token role (§9). */
const ICON = 16;

export const entry: GalleryEntry = {
  id: 'tooltip',
  covers: ['Tooltip', 'TooltipContent', 'TooltipTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              label={gs('gallery.sample.tooltip.trigger')}
              icon={<Magnet size={ICON} />}
            />
          </TooltipTrigger>
          <TooltipContent>{gs('gallery.sample.tooltip.tip')}</TooltipContent>
        </Tooltip>
      ),
    },
  ],
};
