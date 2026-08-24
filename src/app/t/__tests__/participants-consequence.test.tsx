// @vitest-environment jsdom
/**
 * The participants pane's consequence dialog: the stale restatement, the pattern's line ids,
 * and where focus goes when the dialog closes.
 *
 * R-UI-021 legislates three things about an act's dialog, and only two of them are reachable
 * from a journey. "Confirm carries the digest" and the last-PRINCIPAL refusal are driven end to
 * end by J-003; **"a stale digest re-renders the dialog with what changed"** is not, because a
 * journey would have to move the project's state between one reader's preview and their confirm
 * — a race no test can stage against a live server without inventing a second session and a
 * window to run it in. So the restatement is claimed here instead, at the seam where the pane
 * meets its server actions: the commit answers `CONSEQUENCES_NOT_CARRIED`, the pane previews
 * again, and what comes back is graded line by line.
 *
 * Three claims, all on the same open dialog:
 *
 *   1. Every consequence row is a datum-patterns §9 `consequence-line`, so a pattern-wide scan
 *      sees this act's lines like any other's.
 *   2. A stale digest marks *each* changed line `consequence-stale` — the plural the clause
 *      uses (arbitration of 2026-08-24) — leaves the unchanged ones unmarked, keeps the dialog
 *      open, and re-confirms with the *restated* digest and never the one that went stale.
 *   3. The dialog is controlled and has no `DialogTrigger`, so on every way out focus is owed
 *      back to `participant-assign` and must never land on `<body>` (R-UI-060, WCAG 2.4.3).
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFUSALS } from '../../../core/errors';

/** The pane's whole server surface; this claim is about what the pane does with the answers. */
const previewAssignmentAction = vi.fn();
const commitAssignmentAction = vi.fn();

vi.mock('../[tenantSlug]/p/[projectId]/settings/actions', () => ({
  previewAssignmentAction: (...args: unknown[]) => previewAssignmentAction(...args),
  commitAssignmentAction: (...args: unknown[]) => commitAssignmentAction(...args),
}));

const { ParticipantsPane } = await import(
  '../[tenantSlug]/p/[projectId]/settings/participants/participants-pane'
);

const SLUG = 'acme';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const READER = 'principal@example.test';
const OTHER = 'measurer@example.test';
const READER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

/** The roles, from the vocabulary rather than spelled here (Q-07 reads a literal as a code). */
const { ROLE } = await import('../../../core/acts');

const STALE = REFUSALS.CONSEQUENCES_NOT_CARRIED.code;

/** A preview as the server answers one, with only the facts the dialog renders varying. */
function previewed(
  currentRole: string | null,
  proposedRole: string,
  principalsAfter: number,
  digest: string,
) {
  return {
    ok: true as const,
    value: {
      consequence: {
        act: 'acts.assignParticipantRole',
        tenantId: 'tenant',
        projectId: PROJECT,
        userId: OTHER_ID,
        currentRole,
        proposedRole,
        principalsAfter,
      },
      digest,
    },
  };
}

function renderPane() {
  render(
    <ParticipantsPane
      tenantSlug={SLUG}
      projectId={PROJECT}
      readerEmail={READER}
      members={[
        { userId: READER_ID, email: READER },
        { userId: OTHER_ID, email: OTHER },
      ]}
      roles={[ROLE.PRINCIPAL, ROLE.MEASURER, ROLE.LEAD]}
      defaultRole={ROLE.MEASURER}
      roster={[{ userId: READER_ID, email: READER, role: ROLE.PRINCIPAL }]}
      history={[]}
    />,
  );
}

/** Open the dialog the way the reader does, and answer the first preview from the server. */
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  previewAssignmentAction.mockResolvedValueOnce(previewed(null, ROLE.MEASURER, 1, 'digest-first'));
  await user.click(screen.getByTestId('participant-assign'));
  return screen.findByTestId('consequence-dialog');
}

beforeEach(() => {
  previewAssignmentAction.mockReset();
  commitAssignmentAction.mockReset();
});

afterEach(cleanup);

describe('the participants pane consequence dialog', () => {
  it('renders every consequence row as a pattern consequence line', async () => {
    const user = userEvent.setup();
    renderPane();
    const dialog = await openDialog(user);

    // datum-patterns §9: one `consequence-line` per row of the summary, so a scan that knows
    // the pattern reads this act's lines too. Person, current, proposed, principals.
    expect(within(dialog).getAllByTestId('consequence-line')).toHaveLength(4);
    // Nothing is stale on a first preview.
    expect(within(dialog).queryAllByTestId('consequence-stale')).toHaveLength(0);
  });

  it('re-renders the dialog with what changed when the digest went stale', async () => {
    const user = userEvent.setup();
    renderPane();
    const dialog = await openDialog(user);

    // The state moved between the preview and the confirm: the seam refuses the carried digest.
    commitAssignmentAction.mockResolvedValueOnce({ ok: false, code: STALE });
    // …and the restatement the pane takes next answers with two of the three facts changed:
    // they hold LEAD now, and the project would have two principals rather than one.
    previewAssignmentAction.mockResolvedValueOnce(
      previewed(ROLE.LEAD, ROLE.MEASURER, 2, 'digest-restated'),
    );

    await user.click(screen.getByTestId('consequence-confirm'));

    // R-UI-021: "with what changed" — one marked node per changed line, and the unchanged
    // proposed role is not one of them.
    await waitFor(() =>
      expect(within(dialog).queryAllByTestId('consequence-stale')).toHaveLength(2),
    );
    const marked = within(dialog)
      .getAllByTestId('consequence-stale')
      .map((node) => node.textContent ?? '');
    expect(marked).toContain(ROLE.LEAD);
    expect(marked).toContain('2');

    // The dialog stays open on a restatement: the reader confirms what is shown now.
    expect(screen.getByTestId('consequence-dialog')).toBeDefined();
    // Nothing was committed and no refusal was shown — a stale digest is not a refusal the
    // reader has to read, it is the same act against the state as it now stands.
    expect(screen.queryByTestId('consequence-refusal')).toBeNull();

    // The second confirm carries the *restated* digest, never the one that went stale.
    commitAssignmentAction.mockResolvedValueOnce({
      ok: true,
      value: {
        roster: [
          { userId: READER_ID, email: READER, role: ROLE.PRINCIPAL },
          { userId: OTHER_ID, email: OTHER, role: ROLE.MEASURER },
        ],
        history: [],
      },
    });
    await user.click(screen.getByTestId('consequence-confirm'));

    await waitFor(() => expect(screen.queryByTestId('consequence-dialog')).toBeNull());
    const carried = commitAssignmentAction.mock.calls.map((call) => call[4]);
    expect(carried).toEqual(['digest-first', 'digest-restated']);
    // The roster the commit answered with is what the pane now shows (AC-4).
    expect(screen.getByTestId('participants-roster').textContent).toContain(OTHER);
  });

  it('gives focus back to the assign control when the dialog closes', async () => {
    const user = userEvent.setup();
    renderPane();
    await openDialog(user);
    const assign = screen.getByTestId('participant-assign');

    await user.click(screen.getByTestId('consequence-cancel'));

    await waitFor(() => expect(screen.queryByTestId('consequence-dialog')).toBeNull());
    // R-UI-060 / WCAG 2.4.3: the control the dialog was opened from, never the top of the page.
    await waitFor(() => expect(document.activeElement).toBe(assign));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('gives focus back to the assign control after Escape', async () => {
    const user = userEvent.setup();
    renderPane();
    await openDialog(user);
    const assign = screen.getByTestId('participant-assign');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('consequence-dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(assign));
    expect(document.activeElement).not.toBe(document.body);
  });
});
