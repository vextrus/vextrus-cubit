/*
 * Focus is visible everywhere (docs/design/system.md §7; m0-screens §8 item 7; design gate M2):
 * Tab through the shared pieces with real key presses and every stop shows a 2 px ring.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import { useState } from 'react'
import { UiProviders } from './UiProviders'
import { AccessChip } from './AccessChip'
import { Button, IconButton } from './Button'
import { List } from './List'
import { ReadOnlyChip } from './ReadOnlyChip'
import { Segmented } from './Segmented'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './primitives/tabs'

function Pieces() {
  const [mode, setMode] = useState<'list' | 'sheet'>('list')
  return (
    <div className="flex flex-col gap-4 p-6">
      <Button>Plain</Button>
      <IconButton label="Fit the whole sheet" combo="F">
        <svg />
      </IconButton>
      <Segmented
        label="List or sheet"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: 'List' },
          { value: 'sheet', label: 'Sheet' },
        ]}
      />
      <List label="Sheets" items={['S-01', 'S-02']} getKey={(s) => s} renderItem={(s) => s} />
      <ReadOnlyChip role="guest" />
      <AccessChip vextrus developer="Shapla Homes Ltd" projects="all" until="26 Oct 2026" daysLeft={20} />
      <Tabs defaultValue="selection">
        <TabsList>
          <TabsTrigger value="selection">Selection</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="selection">The selected sheet</TabsContent>
      </Tabs>
    </div>
  )
}

function ringOf(el: Element): string {
  const s = getComputedStyle(el)
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2
  return outline ? `outline ${s.outlineWidth} ${s.outlineColor}` : 'none'
}

describe('every Tab stop in the shared pieces shows the focus ring', () => {
  it('draws a 2 px ring on each stop, the Tabs panel included', async () => {
    render(
      <UiProviders>
        <Pieces />
      </UiProviders>,
    )
    const seen: { stop: string; ring: string }[] = []
    for (let i = 0; i < 8; i++) {
      await userEvent.keyboard('{Tab}')
      const el = document.activeElement!
      seen.push({ stop: `${el.tagName.toLowerCase()}[role=${el.getAttribute('role') ?? ''}] ${el.textContent?.slice(0, 20) ?? ''}`, ring: el.matches(':focus-visible') ? ringOf(el) : 'not focus-visible' })
    }
    expect(seen.map((s) => s.stop)).toContainEqual(expect.stringMatching(/tabpanel/))
    expect(seen.filter((s) => !s.ring.startsWith('outline'))).toEqual([])
  })
})
