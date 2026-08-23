// @vitest-environment jsdom
/**
 * inc-009 acceptance — AC-4: the seven R-UI-050 states the shell can render, and the barrel
 * that carries them (`src/ui/shell/index.ts`).
 *
 * R-UI-050: "Every screen defines and renders: loading (skeleton), empty (teaches next
 * action), error (retry + report id), refusal (code + remedy), partial (some rows refused:
 * shown, not hidden), offline (banner; read-only), permission-denied (what permission, who
 * holds it)." docs/design/shell.md §6 fixes `ShellAreaState`'s prop names per state and says
 * it composes the existing `src/ui/patterns` exports and the Skeleton primitive — "not
 * re-implementations", in the increment's own words. So every state here is judged twice:
 * the test id it must expose, and a sentence that can only be on screen if the patterns
 * register wrote it. A hand-rolled error block with the same test id fails the second half.
 *
 * The barrel is imported through a specifier assembled at run time. A literal
 * `import('../index')` of a module that does not exist yet is resolved by vite at transform
 * time, and the whole file then reports "no tests" instead of the red it was written to be —
 * which is a Verifier defect wearing a product failure's clothes.
 *
 * The roster assertion is a floor, never a frozen set: `src/ui/shell` is a module later
 * increments keep filling, and a pinned export list would pass today and redden the first
 * increment that lawfully adds to it.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentType, ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REFUSALS } from '../../../core/errors';
import { PATTERNS_STRINGS } from '../../patterns/strings';

/** The seven R-UI-050 states, in the order the clause names them. */
const STATES = [
  'loading',
  'empty',
  'error',
  'refusal',
  'partial',
  'offline',
  'permission-denied',
] as const;

type ShellState = (typeof STATES)[number];

/** The test id each state must put on screen (AC-4, docs/design/shell.md §6). */
const STATE_TESTID: Readonly<Record<ShellState, string>> = {
  loading: 'shell-skeleton',
  empty: 'empty-state',
  error: 'error-state',
  refusal: 'refusal-state',
  partial: 'partial-notice',
  offline: 'offline-banner',
  'permission-denied': 'permission-denied',
};

/**
 * The registered code docs/design/shell.md §6 nominates for the refusal state. Its message
 * and remedy come from the REFUSALS register — L-QTY-04: "reason codes are closed enums,
 * never prose" — which is exactly what makes the remedy text a composition proof.
 */
const REFUSAL_CODE = 'STORAGE_URL_EXPIRED';

/** Substance for the states that carry some. Not copy the product ships — fixture words. */
const EMPTY_TITLE = 'No projects yet.';
const EMPTY_TEACH = 'Create a project, then upload a drawing to start measuring.';
const EMPTY_ACTION = 'Create a project';
const REPORT_ID = 'SHELL-0000';
const PERMISSION = 'project.read';
const HOLDER = 'the workspace owner';
const REFUSED_ROWS = 3;
const EVIDENCE_HREF = '/t/acme/settings';

/** The child a `partial` or `offline` state must keep on screen beside its bar. */
const CHILD_TESTID = 'shell-area-children';

type Props = Record<string, unknown>;

interface ShellBarrel {
  readonly [name: string]: unknown;
  readonly ShellAreaState: ComponentType<Props>;
}

const here = dirname(fileURLToPath(import.meta.url));

/** `src/ui/shell/index.ts` — the interface the Increment Spec names, as a path, not an import. */
const BARREL = join(here, '..', 'index.ts');

/**
 * The barrel, loaded once per test through a specifier the transform cannot see.
 *
 * Its absence is asserted before the import rather than after it: `Cannot find module` from
 * inside a dynamic import reads like a broken mount, and the honest reading — "the increment
 * has not shipped src/ui/shell/index.ts yet" — is one `existsSync` away.
 */
async function barrel(): Promise<ShellBarrel> {
  expect(
    existsSync(BARREL),
    'src/ui/shell/index.ts is not in the tree — the Increment Spec names it as the shell interface',
  ).toBe(true);
  const loaded: unknown = await import(/* @vite-ignore */ BARREL);
  return loaded as ShellBarrel;
}

async function ShellAreaState(): Promise<ComponentType<Props>> {
  const module = await barrel();
  expect(
    typeof module.ShellAreaState,
    'src/ui/shell/index.ts exports no ShellAreaState (AC-4)',
  ).toBe('function');
  return module.ShellAreaState;
}

/** Mount one state with the substance docs/design/shell.md §6 gives it. */
async function mount(state: ShellState, props: Props = {}, children?: ReactElement): Promise<void> {
  const Component = await ShellAreaState();
  render(<Component state={state} {...props}>{children}</Component>);
}

/** The substance each state needs, so the roster test can mount all seven from one table. */
function substanceFor(state: ShellState): Props {
  switch (state) {
    case 'empty':
      return { title: EMPTY_TITLE, teach: EMPTY_TEACH };
    case 'error':
      return { reportId: REPORT_ID, onRetry: (): void => undefined };
    case 'refusal':
      return { code: REFUSAL_CODE, evidenceHref: EVIDENCE_HREF };
    case 'partial':
      return { refusedCount: REFUSED_ROWS };
    case 'permission-denied':
      return { permission: PERMISSION, holder: HOLDER };
    default:
      return {};
  }
}

/** The words of a whole render, so a composition claim reads the screen and not one node. */
const documentText = (): string => document.body.textContent ?? '';

const child = (): ReactElement => <p data-testid={CHILD_TESTID}>{EMPTY_TEACH}</p>;

afterEach(cleanup);

describe('AC-4 — src/ui/shell/index.ts carries the shell interface (R-UI-050)', () => {
  it('exports AppShell and ShellAreaState', async () => {
    const module = await barrel();
    // A floor: the two names the Increment Spec's `interfaces` line fixes. Later increments
    // add to this barrel, and an exact-set assertion would redden the first one that did.
    expect(typeof module['AppShell'], 'src/ui/shell/index.ts exports no AppShell').toBe(
      'function',
    );
    expect(
      typeof module['ShellAreaState'],
      'src/ui/shell/index.ts exports no ShellAreaState',
    ).toBe('function');
  });

  it('mounts every one of the seven states and exposes each one’s test id', async () => {
    // R-UI-050 is a roster, and a screen that can render six of seven has a state it cannot
    // show a reader. Each is mounted on its own so a throw in one names itself.
    for (const state of STATES) {
      await mount(state, substanceFor(state));
      expect(
        screen.queryByTestId(STATE_TESTID[state]),
        `ShellAreaState state="${state}" rendered no [data-testid="${STATE_TESTID[state]}"]`,
      ).not.toBeNull();
      cleanup();
    }
  });
});

describe('AC-4 — each state carries its own substance, composed from src/ui/patterns', () => {
  it('loading renders shell-skeleton, busy and announced, in both shapes', async () => {
    await mount('loading');
    const skeleton = screen.getByTestId('shell-skeleton');
    // docs/design/shell.md §6: the wrapper is `aria-busy="true"` with a visually hidden
    // `role="status"` line, so a screen reader is told the area is working rather than empty.
    expect(skeleton.getAttribute('aria-busy'), 'shell-skeleton is not aria-busy').toBe('true');
    expect(
      skeleton.querySelector('[role="status"]') ?? document.querySelector('[role="status"]'),
      'the loading state announces nothing — R-UI-050 loading has no live region',
    ).not.toBeNull();
    cleanup();

    // §6 gives the inspector its own shape; the prop is the Design Decision's, `shape`.
    await mount('loading', { shape: 'inspector' });
    expect(
      screen.queryByTestId('shell-skeleton'),
      'ShellAreaState state="loading" shape="inspector" rendered no shell-skeleton',
    ).not.toBeNull();
  });

  it('empty teaches its next action and its action affordance fires once', async () => {
    const onAction = vi.fn();
    await mount('empty', {
      title: EMPTY_TITLE,
      teach: EMPTY_TEACH,
      actionLabel: EMPTY_ACTION,
      onAction,
    });

    // R-UI-050 empty: "teaches next action" — the teaching sentence is the screen's, and it
    // has to reach the reader, not just the props object.
    expect(documentText()).toContain(EMPTY_TITLE);
    expect(documentText()).toContain(EMPTY_TEACH);

    const action = screen.getByTestId('empty-state-action');
    expect(action.textContent).toContain(EMPTY_ACTION);
    fireEvent.click(action);
    expect(onAction, 'empty-state-action did not call onAction exactly once').toHaveBeenCalledTimes(
      1,
    );
  });

  it('error shows the report id verbatim, retries on demand, and speaks the patterns register’s words', async () => {
    const onRetry = vi.fn();
    await mount('error', { reportId: REPORT_ID, onRetry });

    // R-UI-050 error: "retry + report id". The id is quoted back by a reader, so it renders
    // exactly as it was given.
    expect(screen.getByTestId('error-state-report-id').textContent).toContain(REPORT_ID);
    fireEvent.click(screen.getByTestId('error-state-retry'));
    expect(onRetry, 'error-state-retry did not call onRetry exactly once').toHaveBeenCalledTimes(1);

    // AC-4: "composing the existing src/ui/patterns components". This sentence exists in one
    // place in the tree — the patterns register — so it can only be on screen if ErrorState
    // wrote it. A look-alike block carrying the same test id fails here.
    expect(
      documentText(),
      'the error state does not speak PATTERNS_STRINGS — is it re-implementing ErrorState?',
    ).toContain(PATTERNS_STRINGS['patterns.error.title']);
  });

  it('refusal shows a registered code with the register’s remedy', async () => {
    const entry = (REFUSALS as Readonly<Record<string, { message: string; remedy: string }>>)[
      REFUSAL_CODE
    ];
    expect(
      entry,
      `${REFUSAL_CODE} is not in the REFUSALS register — docs/design/shell.md §6 nominates it`,
    ).toBeDefined();

    await mount('refusal', { code: REFUSAL_CODE, evidenceHref: EVIDENCE_HREF });

    // R-UI-050 refusal: "code + remedy". Both come from the closed register (L-QTY-04),
    // never from a caller's prose.
    expect(screen.getByTestId('refusal-code').textContent).toContain(REFUSAL_CODE);
    expect(screen.getByTestId('refusal-remedy').textContent).toContain(entry?.remedy ?? '');
  });

  it('partial shows the refused count above rows that stay on screen', async () => {
    await mount('partial', { refusedCount: REFUSED_ROWS }, child());

    // R-UI-050 partial: "some rows refused: shown, not hidden". The notice replacing the
    // content would be the failure mode the clause exists to forbid.
    expect(screen.queryByTestId('partial-notice')).not.toBeNull();
    expect(
      screen.queryByTestId(CHILD_TESTID),
      'the partial state hid its rows — R-UI-050 says shown, not hidden',
    ).not.toBeNull();
  });

  it('offline banners the screen and leaves its content readable', async () => {
    await mount('offline', {}, child());

    expect(screen.queryByTestId('offline-banner')).not.toBeNull();
    expect(
      screen.queryByTestId(CHILD_TESTID),
      'the offline state hid the content — R-UI-050 offline is read-only, not blank',
    ).not.toBeNull();
    // Composition again: the banner's sentence belongs to the patterns register.
    expect(documentText()).toContain(PATTERNS_STRINGS['patterns.offline']);
  });

  it('permission-denied names the permission and who holds it', async () => {
    await mount('permission-denied', { permission: PERMISSION, holder: HOLDER });

    // R-UI-050 permission-denied: "what permission, who holds it" — both, in the reader's
    // words, through the patterns component rather than a bespoke sentence.
    const said = documentText();
    expect(said).toContain(PERMISSION);
    expect(said).toContain(HOLDER);
    expect(said).toContain(PATTERNS_STRINGS['patterns.permission.title']);
  });
});
