// @vitest-environment jsdom
/**
 * inc-005 acceptance — the primitive roster, exported and mountable (AC-1).
 *
 * R-UI-010 lists the primitives; the Increment Spec's `interfaces` line names the subset
 * this leaf ships and the exact export names the barrel carries. AC-1: "src/ui/primitives/
 * index.ts exports exactly the roster named in `interfaces`; each roster component renders
 * in jsdom under both `data-theme="light"` and `data-theme="dark"` without throwing".
 *
 * Recorded interpretation — "exactly" is read as *at least*, and deliberately not as *no
 * more than*. This barrel is the one R-UI-010 keeps filling: DataTable, Tree, EmptyState,
 * RefusalState, ConsequenceDialog and the rest are named out of scope here because they are
 * later leaves of the same module. An assertion that froze the export set would pass today
 * and redden the first later increment that lawfully adds to it — which the engine's
 * standing lessons record as the cost of freezing a moment instead of encoding a rule. So
 * the roster below is asserted as a floor: every name is exported, and every one of them is
 * something React can mount. A missing name is a red; a name R-UI-010 adds later is not.
 *
 * The barrel is loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

/** The barrel, per test (see the file header). */
const primitives = async () => await import('../index');

type Primitives = typeof import('../index');

/** Both theme selectors inc-004 emits; a primitive has to mount under either (R-UI-001). */
const THEMES: readonly string[] = ['light', 'dark'];

/**
 * The export roster, verbatim from the Increment Spec's `interfaces` line. `toast` is the
 * one function on it; everything else is a component.
 */
const ROSTER: readonly string[] = [
  'Button',
  'IconButton',
  'Input',
  'Textarea',
  'NumberInput',
  'Checkbox',
  'Radio',
  'RadioGroup',
  'Switch',
  'Slider',
  'Select',
  'SelectTrigger',
  'SelectContent',
  'SelectItem',
  'SelectValue',
  'Combobox',
  'Tabs',
  'TabsList',
  'TabsTrigger',
  'TabsContent',
  'Tooltip',
  'TooltipTrigger',
  'TooltipContent',
  'Popover',
  'PopoverTrigger',
  'PopoverContent',
  'DropdownMenu',
  'DropdownMenuTrigger',
  'DropdownMenuContent',
  'DropdownMenuItem',
  'ContextMenu',
  'ContextMenuTrigger',
  'ContextMenuContent',
  'ContextMenuItem',
  'Dialog',
  'DialogTrigger',
  'DialogContent',
  'DialogTitle',
  'DialogDescription',
  'DialogClose',
  'Sheet',
  'SheetTrigger',
  'SheetContent',
  'SheetTitle',
  'SheetClose',
  'Toaster',
  'toast',
  'Badge',
  'Tag',
  'Kbd',
  'Progress',
  'Skeleton',
  'Separator',
];

/** Copy and values the fixtures below need; JSX carries no string literal (R-SPINE-060). */
const NAME = 'Field';
const SAVE = 'Save';
const CLOSE = 'Close';
const TITLE = 'Sheet title';
const DIALOG_TITLE = 'Dialog title';
const DESCRIPTION = 'What this dialog decides.';
const HINT = 'Hint';
const OPEN = 'Open';
const ITEM_ONE = 'First';
const ITEM_TWO = 'Second';
const TAB_ONE_LABEL = 'Overview';
const TAB_TWO_LABEL = 'Detail';
const BADGE = 'Draft';
const TAG = 'Concrete';
const KEY_TEXT = 'Esc';
const AMOUNT = '1234567.89';
const UNIT = 'kg';
const OPTION_A = 'a';
const OPTION_B = 'b';
const TAB_ONE = 'one';
const TAB_TWO = 'two';

const noop = (): void => {
  /* a controlled primitive needs a handler, not a state machine, to mount */
};

const loadNothing = async (): Promise<{ value: string; label: string }[]> => [];

/**
 * One mountable composition per primitive family, covering every name on the roster that is
 * a component. A family's parts only mean anything assembled, so they are asserted that way.
 */
function compositions(module: Primitives): { name: string; node: ReactNode }[] {
  const {
    Button,
    IconButton,
    Input,
    Textarea,
    NumberInput,
    Checkbox,
    Radio,
    RadioGroup,
    Switch,
    Slider,
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
    Combobox,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    Popover,
    PopoverTrigger,
    PopoverContent,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose,
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetTitle,
    SheetClose,
    Toaster,
    Badge,
    Tag,
    Kbd,
    Progress,
    Skeleton,
    Separator,
  } = module;

  return [
    { name: 'Button/primary', node: <Button>{SAVE}</Button> },
    { name: 'Button/secondary', node: <Button variant="secondary">{SAVE}</Button> },
    { name: 'Button/ghost', node: <Button variant="ghost">{SAVE}</Button> },
    { name: 'Button/danger', node: <Button variant="danger">{SAVE}</Button> },
    { name: 'Button/loading', node: <Button loading>{SAVE}</Button> },
    { name: 'Button/icon', node: <Button icon={<Kbd>{KEY_TEXT}</Kbd>}>{SAVE}</Button> },
    { name: 'IconButton', node: <IconButton label={CLOSE} icon={<Kbd>{KEY_TEXT}</Kbd>} /> },
    { name: 'Input', node: <Input aria-label={NAME} /> },
    { name: 'Textarea', node: <Textarea aria-label={NAME} /> },
    {
      name: 'NumberInput',
      node: <NumberInput value={AMOUNT} onValueChange={noop} unit={UNIT} aria-label={NAME} />,
    },
    { name: 'Checkbox', node: <Checkbox aria-label={NAME} /> },
    {
      name: 'RadioGroup',
      node: (
        <RadioGroup aria-label={NAME}>
          <Radio value={OPTION_A} aria-label={ITEM_ONE} />
          <Radio value={OPTION_B} aria-label={ITEM_TWO} />
        </RadioGroup>
      ),
    },
    { name: 'Switch', node: <Switch aria-label={NAME} /> },
    { name: 'Slider', node: <Slider aria-label={NAME} min={0} max={10} step={1} /> },
    {
      name: 'Select',
      node: (
        <Select>
          <SelectTrigger aria-label={NAME}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OPTION_A}>{ITEM_ONE}</SelectItem>
            <SelectItem value={OPTION_B}>{ITEM_TWO}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    { name: 'Combobox', node: <Combobox loadOptions={loadNothing} aria-label={NAME} /> },
    {
      name: 'Tabs',
      node: (
        <Tabs defaultValue={TAB_ONE}>
          <TabsList aria-label={NAME}>
            <TabsTrigger value={TAB_ONE}>{TAB_ONE_LABEL}</TabsTrigger>
            <TabsTrigger value={TAB_TWO}>{TAB_TWO_LABEL}</TabsTrigger>
          </TabsList>
          <TabsContent value={TAB_ONE}>{ITEM_ONE}</TabsContent>
          <TabsContent value={TAB_TWO}>{ITEM_TWO}</TabsContent>
        </Tabs>
      ),
    },
    {
      name: 'Tooltip',
      node: (
        <Tooltip defaultOpen>
          <TooltipTrigger>{OPEN}</TooltipTrigger>
          <TooltipContent>{HINT}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      name: 'Popover',
      node: (
        <Popover defaultOpen>
          <PopoverTrigger>{OPEN}</PopoverTrigger>
          <PopoverContent>{HINT}</PopoverContent>
        </Popover>
      ),
    },
    {
      name: 'DropdownMenu',
      node: (
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>{OPEN}</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{ITEM_ONE}</DropdownMenuItem>
            <DropdownMenuItem>{ITEM_TWO}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      name: 'ContextMenu',
      node: (
        <ContextMenu>
          <ContextMenuTrigger>{OPEN}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>{ITEM_ONE}</ContextMenuItem>
            <ContextMenuItem>{ITEM_TWO}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
    },
    {
      name: 'Dialog',
      node: (
        <Dialog defaultOpen>
          <DialogTrigger>{OPEN}</DialogTrigger>
          <DialogContent>
            <DialogTitle>{DIALOG_TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
            <DialogClose>{CLOSE}</DialogClose>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      name: 'Sheet',
      node: (
        <Sheet defaultOpen>
          <SheetTrigger>{OPEN}</SheetTrigger>
          <SheetContent>
            <SheetTitle>{TITLE}</SheetTitle>
            <SheetClose>{CLOSE}</SheetClose>
          </SheetContent>
        </Sheet>
      ),
    },
    { name: 'Toaster', node: <Toaster /> },
    { name: 'Badge', node: <Badge>{BADGE}</Badge> },
    { name: 'Tag', node: <Tag>{TAG}</Tag> },
    { name: 'Kbd', node: <Kbd>{KEY_TEXT}</Kbd> },
    { name: 'Progress', node: <Progress value={40} max={100} aria-label={NAME} /> },
    { name: 'Skeleton', node: <Skeleton /> },
    { name: 'Separator', node: <Separator /> },
  ];
}

afterEach(() => {
  cleanup();
});

describe('AC-1 — the barrel carries the roster (R-UI-010)', () => {
  it('exports every name the Increment Spec names', async () => {
    const module = await import('../index');
    const exported = new Set(Object.keys(module));
    const missing = ROSTER.filter((name) => !exported.has(name));
    expect(missing, `src/ui/primitives/index.ts does not export: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('exports nothing on the roster as undefined', async () => {
    const module = await import('../index');
    const registered = new Map(Object.entries(module));
    const empty = ROSTER.filter((name) => registered.get(name) === undefined);
    expect(empty, `exported but not defined: ${empty.join(', ')}`).toEqual([]);

    // A component is a function or a `forwardRef`/`memo` object; `toast` is plainly a
    // function. Either way the value has to be something React can be handed.
    const wrong = ROSTER.filter((name) => {
      const value = registered.get(name);
      return typeof value !== 'function' && typeof value !== 'object';
    });
    expect(wrong, `not mountable/callable: ${wrong.join(', ')}`).toEqual([]);
  });

  it('exports `toast` as the function that raises one', async () => {
    const { toast } = await primitives();
    expect(typeof toast, 'toast is the imperative half of R-UI-010 Toast (sonner)').toBe(
      'function',
    );
  });
});

describe('AC-1 — every primitive mounts under both themes (R-UI-001)', () => {
  for (const theme of THEMES) {
    it(`mounts every composition under data-theme="${theme}" without throwing`, async () => {
      const module = await primitives();
      for (const { name, node } of compositions(module)) {
        let thrown: unknown = null;
        try {
          render(<div data-theme={theme}>{node}</div>);
        } catch (error) {
          thrown = error;
        }
        expect(
          thrown,
          `${name} threw under data-theme="${theme}": ${thrown instanceof Error ? thrown.message : String(thrown)}`,
        ).toBeNull();
        cleanup();
      }
    });
  }
});
