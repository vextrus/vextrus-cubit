// @vitest-environment jsdom
/**
 * inc-005 acceptance — the focus and naming baseline, and Button/IconButton (AC-2).
 *
 * R-UI-012: "Every interactive element: focus ring (2 px cobalt outer), keyboard reachable,
 * ARIA labelled; colour contrast ≥ 4.5:1 for text (≥ 3:1 large/UI); axe serious/critical = 0
 * on every screen (Q-11)." Contrast is out of scope for this leaf — inc-004 fixed the token
 * values — and axe lands with the gallery. What is in scope is the other three, and all
 * three are one property per primitive: the thing a Tab key lands on carries the ring class,
 * and it has a name.
 *
 * jsdom computes no stylesheet, so the ring is asserted in two halves, exactly as the test
 * contract states: the class is on the focused element, and the class means 2 px of cobalt
 * because src/ui/primitives/primitives.css says so in text.
 *
 * "Keyboard reachable" is asserted the only way that is not a restatement of the markup:
 * with nothing focused, one Tab lands on the primitive's control. A control a Tab cannot
 * reach fails here regardless of what attributes it carries.
 *
 * ContextMenu is absent from the roving list on purpose: its trigger is a region you press
 * the context key on, not a tab stop, and the Increment Spec scopes its keyboard contract to
 * "reachable *while open*" (AC-7). Its items are held to the same ring rule there.
 *
 * The barrel is loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

const REPO = process.cwd();

const BARREL = 'src/ui/primitives/index.ts';
const SHEET = 'src/ui/primitives/primitives.css';

/** The class the test contract names, and the declaration it has to stand for. */
const RING_CLASS = 'datum-focus-ring';
const RING_SELECTOR = '.datum-focus-ring:focus-visible';

/** The barrel, per test (see the file header). */
const primitives = async () => await import('../index');

type Primitives = typeof import('../index');

const NAME = 'Field';
const SAVE = 'Save';
const CLOSE = 'Close';
const OPEN = 'Open';
const HINT = 'Hint';
const ITEM_ONE = 'First';
const ITEM_TWO = 'Second';
const TAB_ONE_LABEL = 'Overview';
const TAB_ONE = 'one';
const OPTION_A = 'a';
const OPTION_B = 'b';
const AMOUNT = '1234';
const ICON_TESTID = 'button-icon-slot';

const noop = (): void => {
  /* a controlled primitive needs a handler, not a state machine, to mount */
};

const loadNothing = async (): Promise<{ value: string; label: string }[]> => [];

function read(relative: string): string {
  expect(existsSync(join(REPO, relative)), `missing ${relative}`).toBe(true);
  return readFileSync(join(REPO, relative), 'utf8');
}

/**
 * An accessible name, as far as jsdom can be asked for one: an explicit label, a label the
 * markup points at, or the control's own text. Not the full accname algorithm — enough to
 * tell a named control from an unnamed one, which is what R-UI-012 asks.
 */
function accessibleName(element: Element): string {
  const explicit = element.getAttribute('aria-label');
  if (explicit !== null && explicit.trim().length > 0) return explicit.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    const named = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (named.length > 0) return named;
  }

  const id = element.getAttribute('id');
  if (id !== null) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
    const text = label?.textContent?.trim() ?? '';
    if (text.length > 0) return text;
  }

  return element.textContent?.trim() ?? '';
}

/**
 * One primitive per row, rendered alone so that the first Tab has exactly one place to go.
 * The roster is every interactive name the Increment Spec's `interfaces` line carries.
 */
function keyboardCases(module: Primitives): { name: string; node: ReactNode }[] {
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
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetTitle,
  } = module;

  return [
    { name: 'Button', node: <Button>{SAVE}</Button> },
    { name: 'IconButton', node: <IconButton label={CLOSE} icon={<span />} /> },
    { name: 'Input', node: <Input aria-label={NAME} /> },
    { name: 'Textarea', node: <Textarea aria-label={NAME} /> },
    {
      name: 'NumberInput',
      node: <NumberInput value={AMOUNT} onValueChange={noop} aria-label={NAME} />,
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
          </TabsList>
          <TabsContent value={TAB_ONE}>{ITEM_ONE}</TabsContent>
        </Tabs>
      ),
    },
    {
      name: 'Tooltip',
      node: (
        <Tooltip>
          <TooltipTrigger>{OPEN}</TooltipTrigger>
          <TooltipContent>{HINT}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      name: 'Popover',
      node: (
        <Popover>
          <PopoverTrigger>{OPEN}</PopoverTrigger>
          <PopoverContent>{HINT}</PopoverContent>
        </Popover>
      ),
    },
    {
      name: 'DropdownMenu',
      node: (
        <DropdownMenu>
          <DropdownMenuTrigger>{OPEN}</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{ITEM_ONE}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      name: 'Dialog',
      node: (
        <Dialog>
          <DialogTrigger>{OPEN}</DialogTrigger>
          <DialogContent>
            <DialogTitle>{HINT}</DialogTitle>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      name: 'Sheet',
      node: (
        <Sheet>
          <SheetTrigger>{OPEN}</SheetTrigger>
          <SheetContent>
            <SheetTitle>{HINT}</SheetTitle>
          </SheetContent>
        </Sheet>
      ),
    },
  ];
}

afterEach(() => {
  cleanup();
});

describe('AC-2 — the ring is 2 px of cobalt, declared once (R-UI-012)', () => {
  it('declares .datum-focus-ring:focus-visible with a 2 px cobalt outline', () => {
    const sheet = read(SHEET);

    const at = sheet.indexOf(RING_SELECTOR);
    expect(at, `${SHEET} declares no ${RING_SELECTOR} rule`).toBeGreaterThan(-1);

    const open = sheet.indexOf('{', at);
    const close = sheet.indexOf('}', open);
    expect(close, `${RING_SELECTOR} has no rule body`).toBeGreaterThan(open);
    const body = sheet.slice(open, close);

    // R-UI-012's own words — 2 px, cobalt, outer. The colour is the token, never a literal
    // (R-UI-001), which is also why this is `var(--cobalt-500)` and not a hex.
    expect(body.replace(/\s+/g, ' '), `${RING_SELECTOR} is not a 2 px cobalt outline`).toMatch(
      /outline:\s*2px\s+solid\s+var\(--cobalt-500\)/,
    );
  });

  it('is imported by the barrel, so a consumer of the module gets the ring', () => {
    const barrel = read(BARREL);
    expect(barrel, `${BARREL} does not import ${SHEET}`).toMatch(
      /import\s+['"]\.\/primitives\.css['"]/,
    );
  });
});

describe('AC-2 — every interactive primitive is reachable, ringed and named (R-UI-012)', () => {
  it('lands one Tab on a control that carries the ring class and has a name', async () => {
    const module = await primitives();
    const complaints: string[] = [];

    for (const { name, node } of keyboardCases(module)) {
      const user = userEvent.setup();
      render(<div>{node}</div>);
      await user.tab();

      const focused = document.activeElement;
      if (focused === null || focused === document.body) {
        complaints.push(`${name}: one Tab reached nothing — the control is not keyboard reachable`);
      } else {
        if (!focused.classList.contains(RING_CLASS)) {
          complaints.push(
            `${name}: the focused <${focused.tagName.toLowerCase()}> does not carry .${RING_CLASS} (has "${focused.className}")`,
          );
        }
        if (accessibleName(focused).length === 0) {
          complaints.push(`${name}: the focused control has no ARIA name`);
        }
      }
      cleanup();
    }

    expect(complaints, complaints.join('\n')).toEqual([]);
  });
});

describe('AC-2 — Button and IconButton (R-UI-010)', () => {
  it('renders each of the four variants as a distinct button', async () => {
    const { Button } = await primitives();
    const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
    const painted = new Map<string, string>();

    for (const variant of variants) {
      render(<Button variant={variant}>{SAVE}</Button>);
      // The whole element, not just its class list: a variant may be carried by a class or
      // by a data attribute the sheet selects on, and either is a real distinction. What
      // this refuses is four names that render byte-identical markup — one variant with
      // four spellings.
      painted.set(variant, screen.getByRole('button').outerHTML);
      cleanup();
    }

    expect(
      new Set(painted.values()).size,
      `the four variants are not distinct: ${[...painted].map(([name, html]) => `${name}=${html}`).join('\n')}`,
    ).toBe(variants.length);
  });

  it('defaults to the primary variant', async () => {
    const { Button } = await primitives();

    render(<Button>{SAVE}</Button>);
    const byDefault = screen.getByRole('button').outerHTML;
    cleanup();

    render(<Button variant="primary">{SAVE}</Button>);
    const explicit = screen.getByRole('button').outerHTML;

    expect(byDefault, 'the default variant is not `primary`').toBe(explicit);
  });

  it('marks a loading button aria-busy and refuses to activate', async () => {
    const { Button } = await primitives();
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button loading onClick={onClick}>
        {SAVE}
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-busy'), 'a loading button is not aria-busy').toBe('true');

    await user.click(button);
    expect(onClick, 'a loading button activated — the act would run twice').not.toHaveBeenCalled();
  });

  it('renders the icon slot inside the button', async () => {
    const { Button } = await primitives();

    render(<Button icon={<span data-testid={ICON_TESTID} />}>{SAVE}</Button>);

    const icon = screen.getByTestId(ICON_TESTID);
    expect(screen.getByRole('button').contains(icon), 'the icon slot is not inside the button').toBe(
      true,
    );
  });

  it('renders the IconButton label as its aria-label', async () => {
    const { IconButton } = await primitives();

    render(<IconButton label={CLOSE} icon={<span data-testid={ICON_TESTID} />} />);

    // An icon-only control is the commonest way to ship an unnamed button; the prop is
    // required so that it cannot be shipped that way.
    const button = screen.getByRole('button', { name: CLOSE });
    expect(button.getAttribute('aria-label')).toBe(CLOSE);
    expect(button.contains(screen.getByTestId(ICON_TESTID))).toBe(true);
  });
});
