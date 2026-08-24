/**
 * The rule-set editions' refusals (L-MEA-01, R-SPINE-062).
 *
 * One code today. L-MEA-01 gives an edition exactly one lawful way to change — "authoring
 * mints a new edition, never updates one" — so the only refusal the machinery can raise at M0
 * is the one the database itself raises when something tries to rewrite an edition that is
 * already pinned by a project. The trigger in `db/migrations/0003_spine_rulesets.sql` names
 * this code in its message, so the refusal a caller reads and the refusal registered here are
 * the same one rather than two spellings of a similar idea.
 *
 * It reaches no screen: the ruleset pane is read-only and performs no act
 * (docs/design/s-project-settings.md Interpretation 1, §6), so the message and remedy are
 * written for whoever meets it in a lane's output or a log. Authoring — the act that would put
 * this code in front of a person — is M3.
 */
import { registry } from './types';

export const RULESET_REFUSALS = registry({
  EDITION_IMMUTABLE: {
    code: 'EDITION_IMMUTABLE',
    message: 'A rule-set edition is written once and never changed.',
    remedy:
      'Author a new edition instead. Projects that pinned this one keep reading exactly the values they pinned.',
    severity: 'block',
    surface: 'log',
  },
});
