// @vitest-environment jsdom
/**
 * Every primitive mounts in a DOM that has no layout (R-UI-010).
 *
 * A component library is used from unit tests as much as from a browser, and the DOM those
 * tests run in implements no layout: no `ResizeObserver`, no pointer capture, no
 * `scrollIntoView`, every box zero. A primitive that throws there is a primitive nobody can
 * mount without first discovering which shim it wanted — which is how this increment lost an
 * attempt, on a Slider that measured its own thumb.
 *
 * So this suite installs nothing. It mounts the whole roster bare, in both themes, and asserts
 * that mounting is silent: no throw, and no error on the console either, since React reports a
 * failed effect that way rather than by rejecting the render.
 *
 * What it does not claim is that every overlay can be *opened* bare: Radix's Select scrolls its
 * chosen item into view when it opens, which is a layout call, and the acceptance suites shim
 * it (src/ui/primitives/__tests__/jsdom-support.ts). Opening is asserted there. Mounting, and
 * the keyboard on the controls that own their own keys, are asserted here.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Badge,
  Button,
  Checkbox,
  Combobox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Kbd,
  NumberInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Radio,
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  Textarea,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../index';

const NAME = 'Field';
const SAVE = 'Save';
const CLOSE = 'Close';
const OPEN = 'Open';
const HINT = 'Hint';
const TITLE = 'Title';
const DESCRIPTION = 'What this decides.';
const ITEM_ONE = 'First';
const ITEM_TWO = 'Second';
const BADGE = 'Draft';
const TAG = 'Concrete';
const KEY_TEXT = 'Esc';
const AMOUNT = '1234567.89';
const UNIT = 'kg';
const OPTION_A = 'a';
const OPTION_B = 'b';
const TAB_ONE = 'one';
const MENU = 'menu';
const DIALOG = 'dialog';
const SLIDER = 'slider';

const noop = (): void => {
  /* a controlled primitive needs a handler, not a state machine, to mount */
};

const loadNothing = async (): Promise<{ value: string; label: string }[]> => [];

/** The roster, assembled the way a screen assembles it. */
function compositions(): { name: string; node: ReactNode }[] {
  return [
    { name: 'Button', node: <Button icon={<Kbd>{KEY_TEXT}</Kbd>}>{SAVE}</Button> },
    { name: 'Button/loading', node: <Button loading>{SAVE}</Button> },
    { name: 'IconButton', node: <IconButton label={CLOSE} icon={<span />} /> },
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
    { name: 'Slider/range', node: <Slider aria-label={NAME} defaultValue={[2, 8]} /> },
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
            <TabsTrigger value={TAB_ONE}>{ITEM_ONE}</TabsTrigger>
          </TabsList>
          <TabsContent value={TAB_ONE}>{ITEM_TWO}</TabsContent>
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
      name: 'ContextMenu',
      node: (
        <ContextMenu>
          <ContextMenuTrigger>{OPEN}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>{ITEM_ONE}</ContextMenuItem>
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
            <DialogTitle>{TITLE}</DialogTitle>
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
    { name: 'Tag', node: <Tag onRemove={noop}>{TAG}</Tag> },
    { name: 'Kbd', node: <Kbd>{KEY_TEXT}</Kbd> },
    { name: 'Progress', node: <Progress value={40} aria-label={NAME} /> },
    { name: 'Skeleton', node: <Skeleton /> },
    { name: 'Separator', node: <Separator /> },
  ];
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the roster mounts in a DOM with no layout (R-UI-010)', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`mounts every composition under data-theme="${theme}" without a throw or an error`, () => {
      const complaints: string[] = [];

      for (const { name, node } of compositions()) {
        // React reports a failed layout effect to the console rather than to the caller, so a
        // silent mount has to be asserted on both channels.
        const errors: string[] = [];
        const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
          errors.push(args.map((argument) => String(argument)).join(' '));
        });
        try {
          render(<div data-theme={theme}>{node}</div>);
        } catch (error) {
          complaints.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          spy.mockRestore();
          cleanup();
        }
        for (const message of errors) complaints.push(`${name}: ${message}`);
      }

      expect(complaints, complaints.join('\n')).toEqual([]);
    });
  }
});

describe('the keyboard works in a DOM with no layout (R-UI-012)', () => {
  it('steps a Slider with the arrows', async () => {
    const user = userEvent.setup();
    render(<Slider aria-label={NAME} min={0} max={10} step={1} defaultValue={[4]} />);

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the thumb').toBe(
      screen.getByRole(SLIDER),
    );

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole(SLIDER).getAttribute('aria-valuenow')).toBe('5');
  });

  it('toggles a Switch and moves a RadioGroup', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Switch aria-label={NAME} />
        <RadioGroup aria-label={TITLE}>
          <Radio value={OPTION_A} aria-label={ITEM_ONE} />
          <Radio value={OPTION_B} aria-label={ITEM_TWO} />
        </RadioGroup>
      </>,
    );

    await user.tab();
    await user.keyboard('[Space]');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked')),
    ).toEqual(['false', 'true']);
  });

  it('opens a DropdownMenu from its trigger', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>{OPEN}</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>{ITEM_ONE}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole(MENU), 'Enter did not open the menu').toBeTruthy();
  });

  it('closes a Dialog on Escape and hands the focus back', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>{OPEN}</DialogTrigger>
        <DialogContent>
          <DialogTitle>{TITLE}</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.tab();
    const trigger = document.activeElement;
    await user.keyboard('{Enter}');
    expect(await screen.findByRole(DIALOG), 'Enter did not open the dialog').toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole(DIALOG), 'Escape did not close the dialog').toBeNull();
    expect(document.activeElement, 'Escape stranded the focus').toBe(trigger);
  });
});
