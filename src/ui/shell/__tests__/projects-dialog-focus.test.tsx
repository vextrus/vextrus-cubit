// @vitest-environment jsdom
/**
 * The Projects create dialog gives focus back to the control it was opened from.
 *
 * R-UI-060 asks for keyboard operability on every screen, and WCAG 2.4.3 (focus order) is
 * what a dismissed modal owes: the reader goes back to where they were, not to the top of
 * the document. The dialog is opened from the projects area's create affordance rather than
 * from a `DialogTrigger`, and Radix restores focus only to a trigger it rendered itself — its
 * close handler prevents the FocusScope fallback and then focuses a `triggerRef` that is null
 * here. Left alone, Escape drops the reader on `<body>` and they have to tab the whole shell
 * again.
 *
 * The two dismissals are both exercised: Escape, and the dialog's own close control. Each one
 * asserts the element that holds focus afterwards, because `toBeHidden` passing is exactly
 * what hid this defect from the journey.
 *
 * inc-014 re-pointed this claim, unchanged, at the component that now holds it. The dialog
 * docs/design/shell.md §4 fixed was an in-place one opened from `ProjectsEmptyState`; s-home
 * Interpretation 2 makes it route-driven — `/t/{slug}/projects/new` *is* the projects area
 * with the create Dialog open — so the affordance it returns focus to is the one on the page
 * it navigates back to (`home-create-project` or `empty-state-action`, s-home
 * Interpretation 8). Same law, same two dismissals, same assertions; only the component that
 * owes it moved.
 */
import { cleanup, getByLabelText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIMITIVES_STRINGS } from '../../primitives/strings';

/** The route-driven Dialog navigates on close; the navigation itself is Next's, not the claim's. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => '/t/acme/projects/new',
}));

/** The create act is a server action; this claim is about focus, and never submits. */
vi.mock('../../../app/t/[tenantSlug]/(area)/projects/actions', () => ({
  createProjectAction: () => Promise.resolve({ ok: false }),
}));

const { CreateProjectDialog } = await import(
  '../../../app/t/[tenantSlug]/(area)/projects/create-dialog'
);

afterEach(cleanup);

const SLUG = 'acme';

/**
 * The projects area as the reader left it, with the Dialog open over it — which is what the
 * route renders. The affordance below is the one focus is owed back to.
 */
function openArea(): HTMLElement {
  render(
    <div>
      {/* The affordance the area offers; its words are the area's, and this claim is about
          where focus lands rather than about what the control says. */}
      <button type="button" data-testid="home-create-project" />
      <CreateProjectDialog tenantSlug={SLUG} />
    </div>,
  );
  return screen.getByTestId('home-create-project');
}

describe('the Projects create dialog', () => {
  it('returns focus to the create affordance after Escape', async () => {
    const user = userEvent.setup();
    const action = openArea();
    await screen.findByTestId('dialog-content');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('dialog-content')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(action));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('returns focus to the create affordance after the close control', async () => {
    const user = userEvent.setup();
    const action = openArea();
    const dialog = await screen.findByTestId('dialog-content');

    await user.click(getByLabelText(dialog, PRIMITIVES_STRINGS['primitives.dialog.close']));

    await waitFor(() => expect(screen.queryByTestId('dialog-content')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(action));
  });
});
