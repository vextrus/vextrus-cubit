"use client";
/**
 * THE FRAME'S TWO REMAINING SLOTS — the 32 px tool row and the 24 px readout (Direction §1, §3.1).
 *
 * `AppShell` is rendered by the route's server layout and every screen is its `children`, so a
 * screen cannot hand the frame a prop: props travel down, and the tools belong to the screen that
 * is three levels below the frame that draws them. The inspector settled this shape already
 * (`inspector.tsx`) — the frame publishes a slot, the screen mounts through a hook — and these are
 * the same slot twice more, so the frame has ONE way of being filled rather than three.
 *
 * Why a slot at all, and not a region each screen draws for itself: the tool row and the readout
 * are CHROME. Their height is the grid's (`--toolbar-h`, `--status-h`) and the work-surface law is
 * arithmetic over that grid (tests/ui/shell/work-surface-share.test.ts). A screen that drew its own
 * 32 px strip inside `shell-main` would spend the canvas's height on it and the law would read as
 * kept while the canvas shrank — which is exactly the fault §8 scores the viewer 1 on C1 for.
 *
 * The prop on `AppShell` stays what it was: a frame mounted without a screen (the gallery's
 * evidence renderer) still states a readout, and a screen that mounts through the hook overrides it
 * for as long as that screen is on. Leaving the screen puts the frame's own back.
 *
 * BOTH HOOKS ANSWER WHETHER THE FRAME TOOK THE REGION, and that answer is the whole of their
 * contract with a screen rendered outside one. A screen mounted without the frame — a jsdom test of
 * the viewer, the gallery's evidence renderer — handed its readout to a no-op and lost it: the
 * region simply did not exist, and the first thing that noticed was an assertion looking for a
 * readout that a person would also have looked for and not found. `useInspector` may answer nothing
 * because an inspector with no frame has nowhere to be; a READOUT and a TOOL ROW are the screen's own
 * content and always have somewhere to be, which is where they stand when no frame claims them.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

interface SlotsValue {
  readonly toolbar: ReactNode | null;
  readonly status: ReactNode | null;
  readonly page: string | null;
}

/**
 * ONE SCREEN'S HOLD ON A SLOT. A slot is not a variable two screens write in turn: hydration stands
 * a screen twice for ~100 ms (session 6), and the first copy's cleanup — `set(null)` — erased what
 * the second had just put there, so the register opened with no tabs row and no crumb whenever the
 * copies unmounted in that order (session 7: J-000's m2 leg, the craft look's "Register crumb
 * missing"). Comparing values cannot tell the two copies apart — both write the same crumb — so each
 * hook instance holds a claim of its OWN: the latest claim still standing is what the frame shows,
 * a claim that changes keeps its place, and a cleanup withdraws only its own.
 */
type Claim<T> = { readonly owner: object; readonly value: T };

interface SlotsDispatch {
  readonly toolbar: Dispatch<SetStateAction<readonly Claim<ReactNode | null>[]>>;
  readonly status: Dispatch<SetStateAction<readonly Claim<ReactNode | null>[]>>;
  readonly page: Dispatch<SetStateAction<readonly Claim<string | null>[]>>;
}

const SlotsValueContext = createContext<SlotsValue>({ toolbar: null, status: null, page: null });
const SlotsDispatchContext = createContext<SlotsDispatch | null>(null);

/** The claim that stands: the latest one still held, or nothing. */
function standing<T>(claims: readonly Claim<T>[]): T | null {
  return claims.length === 0 ? null : (claims[claims.length - 1] as Claim<T>).value;
}

/**
 * Hold `value` for `owner`: a new claim goes on top, a held one is replaced where it stands, and a
 * claim that already holds exactly this value leaves the slots as they are (no render for nothing).
 */
function claimed<T>(claims: readonly Claim<T>[], owner: object, value: T): readonly Claim<T>[] {
  const at = claims.findIndex((claim) => claim.owner === owner);
  if (at === -1) return [...claims, { owner, value }];
  if ((claims[at] as Claim<T>).value === value) return claims;
  return claims.map((claim, index) => (index === at ? { owner, value } : claim));
}

/** Withdraw `owner`'s claim and nobody else's. */
function withdrawn<T>(claims: readonly Claim<T>[], owner: object): readonly Claim<T>[] {
  return claims.some((claim) => claim.owner === owner) ? claims.filter((claim) => claim.owner !== owner) : claims;
}

export function ShellSlotsProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<readonly Claim<ReactNode | null>[]>([]);
  const [status, setStatus] = useState<readonly Claim<ReactNode | null>[]>([]);
  const [page, setPage] = useState<readonly Claim<string | null>[]>([]);
  const value = useMemo<SlotsValue>(() => ({ toolbar: standing(toolbar), status: standing(status), page: standing(page) }), [toolbar, status, page]);
  const dispatch = useMemo<SlotsDispatch>(() => ({ toolbar: setToolbar, status: setStatus, page: setPage }), []);
  return (
    <SlotsDispatchContext.Provider value={dispatch}>
      <SlotsValueContext.Provider value={value}>{children}</SlotsValueContext.Provider>
    </SlotsDispatchContext.Provider>
  );
}

/**
 * One hook instance's claim on one slot, held for as long as it is mounted.
 *
 * The FIRST claim is made in a layout effect, once: the frame takes a screen's chrome in the commit
 * that mounts the screen, in a lane of its own. As a passive effect it was batched with the screen's
 * own post-mount updates (a grid restoring its remembered columns), and under a slow CPU that batch
 * was parked and never committed — the probe at 6× CPU reopened a 1,162-line register whose claims
 * were made at 0.9 s and 1.5 s and whose frame still had no tabs row and no crumb at 25 s, which is
 * what J-000's m2 leg met under the lane's four workers. What the claim holds AFTER that is updated
 * in a passive effect, as it always was: a screen whose chrome moves with every frame (the viewer's
 * readout) must not re-render the frame synchronously on each one — every claim made in layout did,
 * and the viewer looped until React gave up (session 7, the first run of this change).
 */
function useClaim<T>(set: Dispatch<SetStateAction<readonly Claim<T>[]>> | undefined, value: T): void {
  const [owner] = useState<object>(() => ({}));
  const [atMount] = useState(() => ({ value }));
  useLayoutEffect(() => {
    if (set === undefined) return;
    set((claims) => claimed(claims, owner, atMount.value));
    return () => set((claims) => withdrawn(claims, owner));
  }, [set, owner, atMount]);
  useEffect(() => {
    if (set === undefined) return;
    set((claims) => claimed(claims, owner, value));
  }, [set, owner, value]);
}

/**
 * What a screen mounts its tool row through. Hand it the groups; hand it `null` and the track
 * collapses to zero rather than standing as an empty strip — the inspector's own law (R-UI-080).
 * A screen rendered outside the frame finds no provider and this is a no-op, so no component is
 * ever made to know whether it is inside the shell.
 */
export function useShellToolbar(toolbar: ReactNode | null): boolean {
  const set = useContext(SlotsDispatchContext)?.toolbar;
  useClaim(set, toolbar);
  return set !== undefined;
}

/**
 * The same, for the readout: the screen owns the cells, the frame owns the line (§3.1).
 * Answers whether a frame took it; `false` means the screen renders it where it stands.
 */
export function useShellStatus(status: ReactNode | null): boolean {
  const set = useContext(SlotsDispatchContext)?.status;
  useClaim(set, status);
  return set !== undefined;
}

/**
 * The same again, for the crumb R-UI-084 makes every screen declare: "the breadcrumb always names
 * workspace, project, area and page". The frame draws the trail above every area and a screen is its
 * `children`, so the page a reader is on reaches the top bar the way its tool row and its readout
 * already do — through the slot, rather than by the frame guessing at the address (B-17).
 */
export function useShellPage(page: string | null): boolean {
  const set = useContext(SlotsDispatchContext)?.page;
  useClaim(set, page);
  return set !== undefined;
}

/** The slots as the frame reads them. Absent provider = all empty, which is the frame's default. */
export function useShellSlots(): { toolbar: ReactNode | null; status: ReactNode | null; page: string | null } {
  return useContext(SlotsValueContext);
}
