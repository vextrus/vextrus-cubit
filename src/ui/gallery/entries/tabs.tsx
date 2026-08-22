/** Tabs — three panels, one of them showing (§5). */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The panel keys: the tab set's own vocabulary, not words anybody reads. */
const SHEETS = 'sheets';
const MEASUREMENTS = 'measurements';
const ESTIMATES = 'estimates';

/**
 * The trigger/panel ids are written here rather than left to Radix (§5).
 *
 * Radix pairs a tab with its panel through a base id it mints with React's `useId`, which counts
 * from a module global: the same sheet rendered twice would carry different ids, and the sheet's
 * markup has to be identical across renders. Every one of these attributes is passed after
 * Radix's own in `Primitive.button`/`Primitive.div`, so naming them here overrides the minted
 * pair and keeps the pairing itself exactly as Radix wires it.
 */
const triggerId = (panel: string): string => `gallery-tabs-trigger-${panel}`;
const panelId = (panel: string): string => `gallery-tabs-panel-${panel}`;

export const entry: GalleryEntry = {
  id: 'tabs',
  covers: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <Tabs defaultValue={SHEETS}>
          <TabsList aria-label={gs('gallery.entry.tabs')}>
            <TabsTrigger value={SHEETS} id={triggerId(SHEETS)} aria-controls={panelId(SHEETS)}>
              {gs('gallery.sample.tabs.sheets')}
            </TabsTrigger>
            <TabsTrigger
              value={MEASUREMENTS}
              id={triggerId(MEASUREMENTS)}
              aria-controls={panelId(MEASUREMENTS)}
            >
              {gs('gallery.sample.tabs.measurements')}
            </TabsTrigger>
            <TabsTrigger value={ESTIMATES} id={triggerId(ESTIMATES)} aria-controls={panelId(ESTIMATES)}>
              {gs('gallery.sample.tabs.estimates')}
            </TabsTrigger>
          </TabsList>
          {/* Every trigger names a panel, so every panel is written: a tab whose `aria-controls`
              points at nothing is a dangling IDREF, and activating it would empty the cell. */}
          <TabsContent value={SHEETS} id={panelId(SHEETS)} aria-labelledby={triggerId(SHEETS)}>
            {gs('gallery.sample.tabs.panel')}
          </TabsContent>
          <TabsContent
            value={MEASUREMENTS}
            id={panelId(MEASUREMENTS)}
            aria-labelledby={triggerId(MEASUREMENTS)}
          >
            {gs('gallery.sample.tabs.panel-measurements')}
          </TabsContent>
          <TabsContent
            value={ESTIMATES}
            id={panelId(ESTIMATES)}
            aria-labelledby={triggerId(ESTIMATES)}
          >
            {gs('gallery.sample.tabs.panel-estimates')}
          </TabsContent>
        </Tabs>
      ),
    },
  ],
};
