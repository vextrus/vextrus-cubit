// @vitest-environment jsdom
/**
 * The Projects create dialog gives focus back to the control it was opened from.
 *
 * R-UI-060 asks for keyboard operability on every screen, and WCAG 2.4.3 (focus order) is
 * what a dismissed modal owes: the reader goes back to where they were, not to the top of
 * the document. The dialog docs/design/shell.md §4 fixes is opened from the EmptyState's own
 * action rather than from a `DialogTrigger`, and Radix restores focus only to a trigger it
 * rendered itself — its close handler prevents the FocusScope fallback and then focuses a
 * `triggerRef` that is null here. Left alone, Escape drops the reader on `<body>` and they
 * have to tab the whole shell again.
 *
 * The two dismissals §4 names are both exercised: Escape, and the dialog's own close
 * control. Each one asserts the element that holds focus afterwards, because `toBeHidden`
 * passing is exactly what hid this defect from the journey.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectsEmptyState } from '../../../app/t/[tenantSlug]/projects/projects-empty';
import { PRIMITIVES_STRINGS } from '../../primitives/strings';

afterEach(cleanup);

/** Opens the dialog from the empty state's action, the way a reader does. */
async function openFromAction(): Promise<HTMLElement> {
  const user = userEvent.setup();
  render(<ProjectsEmptyState />);
  const action = screen.getByTestId('empty-state-action');
  action.focus();
  await user.click(action);
  await screen.findByTestId('dialog-content');
  return action;
}

describe('the Projects create dialog', () => {
  it('returns focus to the empty state action after Escape', async () => {
    const user = userEvent.setup();
    const action = await openFromAction();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('dialog-content')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(action),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it('returns focus to the empty state action after the close control', async () => {
    const user = userEvent.setup();
    const action = await openFromAction();

    await user.click(screen.getByLabelText(PRIMITIVES_STRINGS['primitives.dialog.close']));

    await waitFor(() => expect(screen.queryByTestId('dialog-content')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(action));
  });
});
