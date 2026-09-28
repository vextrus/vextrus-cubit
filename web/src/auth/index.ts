/*
 * Signing in, the session's pages outside the frame, and the role rule (ticket 20a; m0-screens §1.4,
 * §4.1, §4.2). What later tickets use:
 *
 *   import { can, mayCreateProject, readOnlyRole, useReadOnlyToast } from '@/auth'
 *   if (can(session, 'change')) showAddFiles()                  // 20b: the QS and the Vextrus Engineer
 *   const readOnly = readOnlyRole(session)                       // 'md' | 'guest' | null
 *   const refuse = useReadOnlyToast()
 *   run: () => (readOnly ? refuse(readOnly) : confirm())         // 22: Enter, X, E, a digit, Ctrl Z
 */
export { can, invitableRoles, mayCreateProject, readOnlyRole, type Grant } from './can'
export { ReadOnlyMessage, useReadOnlyToast } from './readOnly'
export { usePageTitle } from './title'
export { safeNext } from './next'
export { enterFrame, atGate, signedIn, gateHref, signInHref } from './gate'
export { useSignOut, useChooseDeveloper } from './actions'
export { SessionWatch, FramePending, useFrameIdentity } from './SessionWatch'
export { sameSession } from './actions'
export { SignInPage } from './SignIn'
export { JoinPage } from './Join'
export { ChooseDeveloperPage } from './ChooseDeveloper'
export { AccessEndedPage, NoAccessPage } from './AccessEnded'
export { CodeList } from './lists'
export { LoadProblem, ProblemBar, ProblemWords, problemOf, problemText, type Problem } from './problem'
export { OutsideRouteError, RouteError } from './RouteError'
