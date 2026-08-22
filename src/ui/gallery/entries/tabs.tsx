/** Tabs — three panels, one of them showing (§5). */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The panel keys: the tab set's own vocabulary, not words anybody reads. */
const SHEETS = 'sheets';
const MEASUREMENTS = 'measurements';
const ESTIMATES = 'estimates';

export const entry: GalleryEntry = {
  id: 'tabs',
  covers: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'],
  states: [
    {
      name: 'default',
      render: () => (
        <Tabs defaultValue={SHEETS}>
          <TabsList aria-label={gs('gallery.entry.tabs')}>
            <TabsTrigger value={SHEETS}>{gs('gallery.sample.tabs.sheets')}</TabsTrigger>
            <TabsTrigger value={MEASUREMENTS}>
              {gs('gallery.sample.tabs.measurements')}
            </TabsTrigger>
            <TabsTrigger value={ESTIMATES}>{gs('gallery.sample.tabs.estimates')}</TabsTrigger>
          </TabsList>
          <TabsContent value={SHEETS}>{gs('gallery.sample.tabs.panel')}</TabsContent>
        </Tabs>
      ),
    },
  ],
};
