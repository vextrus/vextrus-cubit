/**
 * The act seam's refusals (SEAM-ACT, L-ACT-02, L-ACT-03, R-SPINE-062).
 *
 * Three codes, because three clauses give the seam three ways to say no and no clause gives it
 * a fourth:
 *
 *   - L-ACT-02: "a commit whose digest is not the one current state produces refuses
 *     `CONSEQUENCES_NOT_CARRIED`" — the caller is about to change a state they were not shown.
 *   - L-ACT-03: "`PERMISSION_NOT_HELD` carries the act type and missing permission" — the
 *     refusal names both, so a reader learns what would have to be granted rather than that
 *     something was denied.
 *   - L-ACT-03: "the last PRINCIPAL cannot be removed (`PROJECT_WOULD_HAVE_NO_PRINCIPAL`)" —
 *     the one grant a project cannot end up without, checked on the demotion because M0 has no
 *     act that removes a participant outright.
 *
 * This is the only place in `src/` these names may be spelled: Q-07's register reads every
 * screaming-snake literal in product source as a refusal code, and the registries are its own
 * exclusion. Everything above takes them from `src/core/errors`.
 *
 * All three surface as `log` at M0: the seam has no screen yet — R-UI-021's ConsequenceDialog
 * lands with the screens that call it — so whoever meets one of these meets it in a lane's
 * output, a server log or a tRPC error message.
 */
import { registry } from './types';

export const ACT_REFUSALS = registry({
  CONSEQUENCES_NOT_CARRIED: {
    code: 'CONSEQUENCES_NOT_CARRIED',
    message:
      'The consequences you confirmed are not the ones this act would have now — something changed in between.',
    remedy: 'Look at the recomputed consequences and confirm again if they are still what you meant.',
    severity: 'block',
    surface: 'log',
  },
  PERMISSION_NOT_HELD: {
    code: 'PERMISSION_NOT_HELD',
    message: 'Your role on this project does not carry the permission this act moves.',
    remedy: 'Ask a principal on the project to assign you a role that holds it.',
    severity: 'block',
    surface: 'log',
  },
  PROJECT_WOULD_HAVE_NO_PRINCIPAL: {
    code: 'PROJECT_WOULD_HAVE_NO_PRINCIPAL',
    message: 'This would leave the project with no principal, and every project must have one.',
    remedy: 'Assign another participant as principal first, then change this one.',
    severity: 'block',
    surface: 'log',
  },
});
