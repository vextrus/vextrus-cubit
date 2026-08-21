// @vitest-environment jsdom
/**
 * The control semantics of Switch, RadioGroup, Slider and Progress (R-UI-010, R-UI-012).
 *
 * These four are the primitives whose whole contract is ARIA state plus a key press, so they
 * are the ones a restyle can quietly break: a role that is right and a key that does nothing
 * looks correct in a screenshot. Every behaviour below is asserted twice where the driving
 * matters — once through user-event, which sends the full key sequence a browser sends, and
 * once through fireEvent, which sends one event and nothing else. A control that only works
 * under one of the two is depending on the driver rather than on its own handlers.
 *
 * The file deliberately does not install the jsdom shims the acceptance suites use: these
 * primitives must mount and answer keys in a bare jsdom, with no ResizeObserver and no
 * pointer capture, because that is the floor every consumer's own test environment starts at.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Progress, Radio, RadioGroup, Slider, Switch } from '../index';

const NAME = 'Field';
const FIRST = 'First';
const SECOND = 'Second';
const THIRD = 'Third';
const OPTION_A = 'a';
const OPTION_B = 'b';
const OPTION_C = 'c';

const noop = (): void => {
  /* a group nobody is listening to still has to move */
};

afterEach(() => {
  cleanup();
});

/** The three radios every RadioGroup case below uses. */
function renderGroup(onValueChange: (value: string) => void = noop): HTMLElement[] {
  render(
    <RadioGroup aria-label={NAME} onValueChange={onValueChange}>
      <Radio value={OPTION_A} aria-label={FIRST} />
      <Radio value={OPTION_B} aria-label={SECOND} />
      <Radio value={OPTION_C} aria-label={THIRD} />
    </RadioGroup>,
  );
  return screen.getAllByRole('radio');
}

const checkedStates = (radios: readonly HTMLElement[]): (string | null)[] =>
  radios.map((radio) => radio.getAttribute('aria-checked'));

describe('Switch — role="switch", and Space is what toggles it', () => {
  it('renders role="switch" with aria-checked and its name', () => {
    render(<Switch aria-label={NAME} />);
    const control = screen.getByRole('switch', { name: NAME });
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles aria-checked on Space, and back on a second Space', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch aria-label={NAME} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch');

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the switch').toBe(control);

    await user.keyboard('[Space]');
    expect(control.getAttribute('aria-checked'), 'Space did not turn the switch on').toBe('true');

    await user.keyboard('[Space]');
    expect(control.getAttribute('aria-checked'), 'a second Space did not turn it off').toBe('false');
    expect(onCheckedChange.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });

  it('toggles on a bare Space keydown, without the click a browser would synthesise', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label={NAME} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch');

    fireEvent.keyDown(control, { key: ' ', code: 'Space' });
    expect(control.getAttribute('aria-checked'), 'a Space keydown left the switch alone').toBe(
      'true',
    );
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles once — not twice — for one full key press', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label={NAME} defaultChecked={false} />);
    const control = screen.getByRole('switch');

    control.focus();
    await user.keyboard('[Space]');
    expect(control.getAttribute('aria-checked'), 'the switch toggled twice on one press').toBe(
      'true',
    );
  });

  it('still toggles on a pointer click', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label={NAME} />);
    const control = screen.getByRole('switch');

    await user.click(control);
    expect(control.getAttribute('aria-checked')).toBe('true');
  });
});

describe('RadioGroup — one Tab stop, and the arrows both move and choose', () => {
  it('is a single Tab stop: one Tab enters, the next leaves', async () => {
    const user = userEvent.setup();
    render(
      <>
        <RadioGroup aria-label={NAME}>
          <Radio value={OPTION_A} aria-label={FIRST} />
          <Radio value={OPTION_B} aria-label={SECOND} />
          <Radio value={OPTION_C} aria-label={THIRD} />
        </RadioGroup>
        <button type="button">{NAME}</button>
      </>,
    );
    const radios = screen.getAllByRole('radio');

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the group').toBe(radios[0]);

    await user.tab();
    expect(
      radios.includes(document.activeElement as HTMLElement),
      'a second Tab stayed inside the group — it is not one Tab stop',
    ).toBe(false);
  });

  for (const key of ['{ArrowDown}', '{ArrowRight}'] as const) {
    it(`moves and selects with ${key}`, async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      const radios = renderGroup(onValueChange);

      await user.tab();
      await user.keyboard(key);

      expect(document.activeElement, `${key} did not move the focus`).toBe(radios[1]);
      expect(checkedStates(radios), `${key} moved the focus without choosing`).toEqual([
        'false',
        'true',
        'false',
      ]);
      expect(onValueChange).toHaveBeenLastCalledWith(OPTION_B);
    });
  }

  for (const key of ['{ArrowUp}', '{ArrowLeft}'] as const) {
    it(`moves back and selects with ${key}`, async () => {
      const user = userEvent.setup();
      const radios = renderGroup();

      await user.tab();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(checkedStates(radios)).toEqual(['false', 'false', 'true']);

      await user.keyboard(key);
      expect(document.activeElement, `${key} did not move the focus back`).toBe(radios[1]);
      expect(checkedStates(radios), `${key} moved the focus without choosing`).toEqual([
        'false',
        'true',
        'false',
      ]);
    });
  }

  it('moves and selects on a bare arrow keydown', () => {
    const onValueChange = vi.fn();
    const radios = renderGroup(onValueChange);
    const first = radios[0] as HTMLElement;

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown', code: 'ArrowDown' });

    expect(document.activeElement, 'a bare ArrowDown did not move the focus').toBe(radios[1]);
    expect(checkedStates(radios)).toEqual(['false', 'true', 'false']);
    expect(onValueChange).toHaveBeenLastCalledWith(OPTION_B);
  });

  it('wraps from the last option to the first', async () => {
    const user = userEvent.setup();
    const radios = renderGroup();

    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    expect(document.activeElement, 'the roving focus did not wrap').toBe(radios[0]);
    expect(checkedStates(radios)).toEqual(['true', 'false', 'false']);
  });

  it('chooses nothing when the group is merely entered', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    const radios = renderGroup(onValueChange);

    await user.tab();

    expect(checkedStates(radios), 'a Tab into the group chose an option').toEqual([
      'false',
      'false',
      'false',
    ]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('holds one choice at a time', async () => {
    const user = userEvent.setup();
    const radios = renderGroup();

    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');

    expect(checkedStates(radios).filter((state) => state === 'true')).toHaveLength(1);
  });

  it('keeps the caller in charge when it is controlled', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label={NAME} value={OPTION_A} onValueChange={onValueChange}>
        <Radio value={OPTION_A} aria-label={FIRST} />
        <Radio value={OPTION_B} aria-label={SECOND} />
      </RadioGroup>,
    );
    const radios = screen.getAllByRole('radio');

    await user.tab();
    await user.keyboard('{ArrowDown}');

    expect(onValueChange, 'a controlled group did not report the arrow').toHaveBeenLastCalledWith(
      OPTION_B,
    );
    expect(checkedStates(radios), 'a controlled group moved without the caller').toEqual([
      'true',
      'false',
    ]);
  });
});

describe('Slider — role="slider", and an arrow is one step', () => {
  it('exposes the thumb as role="slider" with its value bounds and name', () => {
    render(<Slider aria-label={NAME} min={0} max={10} step={1} defaultValue={[4]} />);
    const thumb = screen.getByRole('slider', { name: NAME });

    expect(thumb.getAttribute('aria-valuenow')).toBe('4');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('10');
  });

  it('raises the value by one step on ArrowRight and lowers it on ArrowLeft', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Slider
        aria-label={NAME}
        min={0}
        max={10}
        step={1}
        defaultValue={[4]}
        onValueChange={onValueChange}
      />,
    );
    const thumb = screen.getByRole('slider');

    await user.tab();
    expect(document.activeElement, 'one Tab did not reach the thumb').toBe(thumb);

    await user.keyboard('{ArrowRight}');
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowRight did not raise the value').toBe('5');

    await user.keyboard('{ArrowLeft}');
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowLeft did not lower the value').toBe('4');
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([[5], [4]]);
  });

  it('steps on a bare arrow keydown', () => {
    render(<Slider aria-label={NAME} min={0} max={10} step={2} defaultValue={[4]} />);
    const thumb = screen.getByRole('slider');

    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow'), 'a bare ArrowRight did not step').toBe('6');

    fireEvent.keyDown(thumb, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowUp did not step').toBe('8');

    fireEvent.keyDown(thumb, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(thumb.getAttribute('aria-valuenow'), 'ArrowDown did not step back').toBe('6');
  });

  it('stops at its bounds', () => {
    render(<Slider aria-label={NAME} min={0} max={2} step={1} defaultValue={[2]} />);
    const thumb = screen.getByRole('slider');

    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(thumb.getAttribute('aria-valuenow'), 'the value went past its maximum').toBe('2');

    for (const _step of [0, 1, 2]) {
      fireEvent.keyDown(thumb, { key: 'ArrowLeft', code: 'ArrowLeft' });
    }
    expect(thumb.getAttribute('aria-valuenow'), 'the value went below its minimum').toBe('0');
  });

  it('starts at its minimum when it is given no value', () => {
    render(<Slider aria-label={NAME} min={2} max={10} step={1} />);
    const thumb = screen.getByRole('slider');
    expect(thumb.getAttribute('aria-valuenow')).toBe('2');
  });

  it('keeps the caller in charge when it is controlled', () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        aria-label={NAME}
        min={0}
        max={10}
        step={1}
        value={[4]}
        onValueChange={onValueChange}
      />,
    );
    const thumb = screen.getByRole('slider');

    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

    expect(onValueChange, 'a controlled slider did not report the arrow').toHaveBeenCalledWith([5]);
    expect(thumb.getAttribute('aria-valuenow'), 'a controlled slider moved itself').toBe('4');
  });
});

describe('Progress — determinate, always (R-UI-010)', () => {
  it('states its position and its bounds', () => {
    render(<Progress value={40} max={100} aria-label={NAME} />);
    const bar = screen.getByRole('progressbar', { name: NAME });

    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('offers no indeterminate mode — a bar with no value still states one', () => {
    for (const node of [
      <Progress key="none" aria-label={NAME} />,
      <Progress key="null" value={null} aria-label={NAME} />,
      <Progress key="scaled" value={3} max={6} aria-label={NAME} />,
    ]) {
      render(node);
      const bar = screen.getByRole('progressbar');
      const now = bar.getAttribute('aria-valuenow');
      expect(now, 'a progressbar without aria-valuenow is the indeterminate mode').not.toBeNull();
      expect(Number.isFinite(Number(now)), `aria-valuenow="${String(now)}" is not a number`).toBe(
        true,
      );
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).not.toBeNull();
      expect(bar.getAttribute('data-state'), 'a Radix indeterminate state leaked out').not.toBe(
        'indeterminate',
      );
      cleanup();
    }
  });

  it('never states a position outside its bounds', () => {
    render(<Progress value={140} max={100} aria-label={NAME} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});
