// @vitest-environment jsdom
/**
 * The Projects create dialog gives focus back to the control it was opened from.
 *
 * R-UI-060 asks for keyboard operability on every screen, and WCAG 2.4.3 (focus order) is
 * what a dismissed modal owes: the reader goes back to where they were, not to the top of
 * the document. The create surface is a route-driven Dialog with no `DialogTrigger` above it,
 * and Radix restores focus only to a trigger it rendered itself — its close handler prevents
 * the FocusScope fallback and then focuses a `triggerRef` that is null here. Left alone,
 * Escape drops the reader on `<body>` and they have to tab the whole shell again.
 *
 * The two dismissals are both exercised: Escape, and the dialog's own close control. Each one
 * asserts the element that holds focus afterwards, because `toBeHidden` passing is exactly
 * what hid this defect from the journey.
 *
 * s-home Interpretation 8 is where this claim now lives: the focus law belongs to the Projects
 * create surface as behaviour, and `/t/{slug}/projects/new` *is* the projects area with that
 * Dialog open (s-home Interpretation 2), so the control focus is owed back to is the create
 * affordance of the page the dismissal returns to. Same law, same two dismissals, same
 * assertions; only the component that owes it moved (arbitration of 2026-08-24, TEST_AMENDED).
 */
import { cleanup, getByLabelText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIMITIVES_STRINGS } from '../../primitives/strings';

/**
 * The route-driven Dialog navigates on close; the navigation itself is Next's, not the claim's.
 * Every method the surface may reach for is present, so a missing one can never be mistaken for
 * a focus defect — whichever way out it takes, the assertions below still read the DOM.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
    prefetch: () => undefined,
  }),
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
    // R-UI-060 / WCAG 2.4.3: the concrete opening control, and never the top of the document.
    await waitFor(() => expect(document.activeElement).toBe(action));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('returns focus to the create affordance after the close control', async () => {
    const user = userEvent.setup();
    const action = openArea();
    const dialog = await screen.findByTestId('dialog-content');

    await user.click(getByLabelText(dialog, PRIMITIVES_STRINGS['primitives.dialog.close']));

    await waitFor(() => expect(screen.queryByTestId('dialog-content')).toBeNull());
    // R-UI-060 / WCAG 2.4.3: the same law the Escape case proves, on the other way out.
    await waitFor(() => expect(document.activeElement).toBe(action));
    expect(document.activeElement).not.toBe(document.body);
  });
});
