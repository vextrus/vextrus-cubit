/** Tabs — three panels, one of them showing (§5). */
import { useState } from 'react';
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

/**
 * The sample owns its selection so it can write `hidden` itself.
 *
 * `forceMount` is what keeps the two unselected panels in the DOM — Radix wraps content in
 * `<Presence present={forceMount || isSelected}>`, so without it the inactive triggers'
 * `aria-controls` are dangling IDREFs on first paint. But `forceMount` also makes Radix pass
 * `hidden={false}` to every mounted panel, which would show all three at once; the panel's own
 * props are spread after Radix's, so the cell restates `hidden` from the selected value and §5's
 * "three panels, one of them showing" holds through every tab click.
 */
function TabsSample() {
  const [selected, setSelected] = useState(SHEETS);
  const panel = (value: string) => ({
    value,
    forceMount: true as const,
    hidden: value !== selected,
    id: panelId(value),
    'aria-labelledby': triggerId(value),
  });
  return (
    <Tabs value={selected} onValueChange={setSelected}>
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
      {/* Every trigger names a panel, so every panel is mounted: a tab whose `aria-controls`
          points at nothing is a dangling IDREF. */}
      <TabsContent {...panel(SHEETS)}>{gs('gallery.sample.tabs.panel')}</TabsContent>
      <TabsContent {...panel(MEASUREMENTS)}>
        {gs('gallery.sample.tabs.panel-measurements')}
      </TabsContent>
      <TabsContent {...panel(ESTIMATES)}>{gs('gallery.sample.tabs.panel-estimates')}</TabsContent>
    </Tabs>
  );
}

export const entry: GalleryEntry = {
  id: 'tabs',
  covers: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'],
  states: [{ name: 'default', render: () => <TabsSample /> }],
};
