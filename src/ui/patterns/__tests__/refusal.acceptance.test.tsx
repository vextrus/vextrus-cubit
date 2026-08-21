// @vitest-environment jsdom
/**
 * inc-006 acceptance — RefusalState and EvidenceLink (AC-3; R-UI-020, R-UI-010).
 *
 * R-UI-020: "a refusal is never a toast alone; it renders in place with code, message, remedy
 * and a link to the evidence or setting that resolves it". R-UI-010 names the same two
 * components: "RefusalState (renders a reason code with message + remedy + evidence link)" and
 * "EvidenceLink (the Trace affordance)".
 *
 * The rule, not a snapshot: the assertions range over `REFUSAL_CODES` — every code the closed
 * register carries — and compare against `REFUSALS[code]` itself. A code a later increment
 * registers is covered here the day it lands, and no message or remedy is copied into this
 * file where it could drift from the register. L-QTY-04 makes that the point: "reason codes
 * are closed enums, never prose", so the prose belongs to the register and the component is
 * only allowed to read it.
 *
 * The barrel is loaded inside each test so a module that does not exist yet reads as one
 * missing behaviour per test rather than a single collection error.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES } from '../../../core/errors';

type PatternsModule = typeof import('../index');

/** The barrel, per test (see the file header). */
const patternsModule = async (): Promise<PatternsModule> => await import('../index');

/** The evidence a refusal points at: the Trace affordance's target (R-UI-020). */
const HREF = '/trace/measurement/0198c0de';
const OTHER_HREF = '/settings/coverage';
const LABEL = 'Open the measurement';

const text = (element: HTMLElement): string => (element.textContent ?? '').trim();

afterEach(cleanup);

describe('AC-3 — a refusal renders in place, from the register (R-UI-020)', () => {
  it('shows the code, and the register’s own message and remedy, for every registered code', async () => {
    const { RefusalState } = await patternsModule();

    expect(REFUSAL_CODES.length, 'the refusal register is empty').toBeGreaterThan(0);

    for (const code of REFUSAL_CODES) {
      const entry = REFUSALS[code];
      const view = render(<RefusalState code={code} evidenceHref={HREF} />);

      expect(text(screen.getByTestId('refusal-code')), `${code}: the code is not shown`).toBe(code);
      // Verbatim: a component that paraphrases a remedy has invented prose for a closed enum.
      expect(text(screen.getByTestId('refusal-message')), `${code}: message not verbatim`).toBe(
        entry.message,
      );
      expect(text(screen.getByTestId('refusal-remedy')), `${code}: remedy not verbatim`).toBe(
        entry.remedy,
      );

      view.unmount();
    }
  });

  it('renders where it was placed, not as a toast (R-UI-020)', async () => {
    const { RefusalState } = await patternsModule();
    const code = REFUSAL_CODES[0];
    if (code === undefined) throw new Error('the refusal register is empty');

    const view = render(<RefusalState code={code} evidenceHref={HREF} />);

    // "in place": the refusal is in the subtree it was rendered into — not portalled to the
    // document body, which is where a toast region and an overlay live.
    const inPlace = view.container.querySelector('[data-testid="refusal-state"]');
    expect(inPlace, 'the refusal did not render in place').not.toBeNull();

    // And no toast was raised on the side. sonner marks its own toasts; inc-005's Toaster
    // carries the region id.
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
    expect(screen.queryByTestId('toast-region')).toBeNull();
  });

  it('carries an evidence link at the href it was given', async () => {
    const { RefusalState } = await patternsModule();
    const code = REFUSAL_CODES[0];
    if (code === undefined) throw new Error('the refusal register is empty');

    render(<RefusalState code={code} evidenceHref={HREF} evidenceLabel={LABEL} />);

    const state = screen.getByTestId('refusal-state');
    const link = within(state).getByTestId('evidence-link');
    expect(link.tagName.toLowerCase(), 'the evidence link is not an anchor').toBe('a');
    expect(link.getAttribute('href')).toBe(HREF);
    expect(text(link)).toBe(LABEL);
  });
});

describe('AC-3 — EvidenceLink is the Trace affordance, exported standalone (R-UI-010)', () => {
  it('renders an anchor at its href, with the text it was given', async () => {
    const { EvidenceLink } = await patternsModule();
    render(<EvidenceLink href={OTHER_HREF}>{LABEL}</EvidenceLink>);

    const link = screen.getByTestId('evidence-link');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe(OTHER_HREF);
    expect(text(link)).toBe(LABEL);
  });

  it('still names itself when no children are given', async () => {
    const { EvidenceLink } = await patternsModule();
    render(<EvidenceLink href={OTHER_HREF} />);

    // A link with no text is a link nobody can follow — the default label is the module's
    // (its copy is checked against the Design Decision in design-decision.acceptance.test.ts).
    expect(text(screen.getByTestId('evidence-link')).length).toBeGreaterThan(0);
  });
});
