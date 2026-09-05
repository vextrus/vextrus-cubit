/**
 * Support for the job-pattern acceptance (R-UI-024). Nothing here is product code: every module
 * under judgement is loaded BY PATH, so a module the Builder has not written yet fails as an
 * assertion naming the file rather than as a collection death that would judge nothing.
 *
 * The rosters this support hands out are read from the tree — the job kinds from the seam's own
 * kind table, the refusal entries from the register, the copy from the assembled string table — so
 * a kind or a code added later is asserted by these files without an edit (B-19).
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { FunctionComponent, ReactNode } from "react";
import { expect, vi } from "vitest";

/**
 * The checkout under test. vitest runs its workers at the config's root, which is the checkout —
 * and `import.meta.url` is not usable in a jsdom file that hoists a `vi.mock` call.
 */
export const REPO_ROOT = process.cwd();

/** The modules the test contract fixes, repo-relative. */
export const PATTERN_BARREL = "src/ui/patterns/job-timeline/index.ts";
export const SHELL_BARREL = "src/ui/shell/index.ts";
export const STRINGS_MODULE = "src/ui/strings/index.ts";
export const KINDS_MODULE = "src/core/jobs/kinds.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const DRAWINGS_DIR = "src/app/(app)/t/[tenant]/p/[project]/drawings";
export const SHEET_INDEX_MODULE = `${DRAWINGS_DIR}/sheet-index.tsx`;
export const DRAWINGS_STRINGS_MODULE = `${DRAWINGS_DIR}/strings.ts`;
export const ROUTE_LOCAL_TIMELINE = `${DRAWINGS_DIR}/job-timeline.tsx`;

/** The ids of the closed test contract, spelled once. */
export const TESTIDS = {
  timeline: "job-timeline",
  idle: "job-timeline-idle",
  step: "job-timeline-step",
  stepStatus: "job-timeline-step-status",
  stepTiming: "job-timeline-step-timing",
  stepFault: "job-timeline-step-fault",
  transportLost: "job-timeline-transport-lost",
  tray: "shell-jobs-tray",
  trayPanel: "shell-jobs-tray-panel",
  trayItem: "shell-jobs-tray-item",
  trayEmpty: "shell-jobs-tray-empty",
  topBar: "shell-topbar",
  refusal: "refusal-state",
  refusalMessage: "refusal-message",
  refusalRemedy: "refusal-remedy",
  refusalEvidence: "refusal-evidence-link",
  skeleton: "skeleton",
} as const;

/** The status words a step can stand at, and the region words derived from them (test contract). */
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "refused";
export type TimelineState = "idle" | "running" | "done" | "failed";

export interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

export interface EvidenceShape {
  href: string;
  label: string;
}

export interface TimelineStepShape {
  id: string;
  jobId: string | null;
  kind: string;
  status: StepStatus;
  timing: string | null;
  refusal: RefusalEntryShape | null;
  faultId: string | null;
  evidence: EvidenceShape;
}

export interface JobTimelineProps {
  heading: string;
  steps: readonly TimelineStepShape[];
  lost?: boolean;
  awaiting?: boolean;
}

export interface TrackedJobShape {
  jobId: string | null;
  kind: string;
  subject: string;
  evidence: EvidenceShape;
}

export interface JobsFormatShape {
  seconds(elapsedMs: number): string;
  refusal(code: string): RefusalEntryShape | null;
}

export type TrackedJobReadingShape = TimelineStepShape & { startedAt: string };

/** The pattern barrel's published surface, as the test contract names it. */
export interface Pattern {
  JobTimeline: FunctionComponent<JobTimelineProps>;
  JobsProvider: FunctionComponent<{ format: JobsFormatShape; children?: ReactNode }>;
  useTrackedJobs(
    jobs: readonly TrackedJobShape[],
    options?: { onSucceeded?: (job: TrackedJobShape) => void },
  ): { steps: readonly TimelineStepShape[]; lost: boolean };
  useJobs(): { jobs: readonly TrackedJobReadingShape[]; state: TimelineState } | null;
}

export interface ShellBarrel {
  ShellTopBar: FunctionComponent<{
    workspace: { tenantId: string; name: string | null };
    area: string;
    atAreaHome: boolean;
    page?: string;
    email: string | null;
    signOut: () => void | Promise<void>;
  }>;
  JobsTray: FunctionComponent<Record<string, never>>;
}

type ModuleBag = Record<string, unknown>;

/**
 * A product module, by repo-relative path. The existence check is what turns "the Builder has not
 * written it yet" into a named assertion instead of an unresolved import that kills the file.
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${relative} is missing from the checkout — the product does not provide it yet`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** Assert a module publishes the named callables, then hand it back in its contracted shape. */
function withExports<T>(bag: ModuleBag, relative: string, names: readonly string[]): T {
  for (const name of names) {
    expect(typeof bag[name], `${relative} does not export ${name} yet`).toBe("function");
  }
  return bag as unknown as T;
}

export async function pattern(): Promise<Pattern> {
  const bag = await productModule<ModuleBag>(PATTERN_BARREL);
  return withExports<Pattern>(bag, PATTERN_BARREL, ["JobTimeline", "JobsProvider", "useTrackedJobs", "useJobs"]);
}

export async function shellBarrel(): Promise<ShellBarrel> {
  const bag = await productModule<ModuleBag>(SHELL_BARREL);
  return withExports<ShellBarrel>(bag, SHELL_BARREL, ["ShellTopBar", "JobsTray"]);
}

/** The assembled string table — the one home every visible word in these files is read from. */
export async function stringsTable(): Promise<Readonly<Record<string, string>>> {
  const bag = await productModule<{ strings?: Readonly<Record<string, string>> }>(STRINGS_MODULE);
  expect(typeof bag.strings, `${STRINGS_MODULE} publishes no assembled table`).toBe("object");
  return bag.strings as Readonly<Record<string, string>>;
}

/** S-Drawings' own copy, which keeps the timeline's heading after the migration. */
export async function drawingsStrings(): Promise<Readonly<Record<string, string>>> {
  const bag = await productModule<{ drawings?: Readonly<Record<string, string>> }>(DRAWINGS_STRINGS_MODULE);
  expect(typeof bag.drawings, `${DRAWINGS_STRINGS_MODULE} publishes no table`).toBe("object");
  return bag.drawings as Readonly<Record<string, string>>;
}

/** One registered string, asserted to exist rather than assumed — a missing key names itself. */
export function stringOf(table: Readonly<Record<string, string>>, key: string): string {
  const value = table[key];
  expect(typeof value, `strings.${key} is not registered yet`).toBe("string");
  return value as string;
}

/** The job kinds, read from the seam's own table so the roster is never transcribed here (B-19). */
export async function kindNames(): Promise<readonly string[]> {
  const bag = await productModule<{ KIND_NAMES?: readonly string[] }>(KINDS_MODULE);
  const names = bag.KIND_NAMES;
  expect(Array.isArray(names), `${KINDS_MODULE} publishes no kind roster`).toBe(true);
  expect((names ?? []).length, "the seam registers at least one job kind").toBeGreaterThan(0);
  return names as readonly string[];
}

export interface ErrorsModule {
  REFUSALS: Readonly<Record<string, RefusalEntryShape>>;
  refusalOf: (code: string) => RefusalEntryShape;
}

/** The refusal register — the entries a surface is judged to render (R-SPINE-062). */
export async function errorsModule(): Promise<ErrorsModule> {
  const bag = await productModule<ModuleBag>(ERRORS_MODULE);
  expect(typeof bag.refusalOf, `${ERRORS_MODULE} publishes no refusalOf`).toBe("function");
  expect(typeof bag.REFUSALS, `${ERRORS_MODULE} publishes no register`).toBe("object");
  return bag as unknown as ErrorsModule;
}

/** A millisecond count as the whole seconds a person reads — the test side of `JobsFormat`. */
const MS_PER_SECOND = 1000;

/**
 * The format the provider is handed. Seconds are the test's own arithmetic (the product's binding
 * lives in the tenant frame and is not what these criteria judge); refusals are the real register,
 * so what a surface shows is what R-SPINE-062 registered and never a fixture sentence.
 */
export function testFormat(errors: ErrorsModule): JobsFormatShape {
  return {
    seconds: (elapsedMs: number): string => `${Math.round(elapsedMs / MS_PER_SECOND)} s`,
    refusal: (code: string): RefusalEntryShape | null => {
      try {
        return errors.refusalOf(code);
      } catch {
        return null;
      }
    },
  };
}

/**
 * The browser facts jsdom does not implement but a shipped overlay asks for. Idempotent, so any
 * suite may simply call it; nothing here is product behaviour, only the platform under the test.
 */
export function installDomStubs(): void {
  const scope = globalThis as unknown as { ResizeObserver?: unknown; matchMedia?: unknown };
  if (typeof scope.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    scope.ResizeObserver = ResizeObserverStub;
  }
  if (typeof scope.matchMedia !== "function") {
    scope.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.scrollIntoView !== "function") proto.scrollIntoView = function scrollIntoView(): void {};
  if (typeof proto.hasPointerCapture !== "function")
    proto.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
  if (typeof proto.releasePointerCapture !== "function") proto.releasePointerCapture = function releasePointerCapture(): void {};
}

/* ------------------------------------------------------------------ *
 * The transports, stubbed. jsdom publishes no EventSource, so the
 * stream leg only exists in a test that installs one.
 * ------------------------------------------------------------------ */

type Listener = (event: Event) => void;

/** A controllable EventSource: it records what was opened and hands frames to the watch by name. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<Listener>>();
  closed = false;
  readyState = 1;
  onmessage: Listener | null = null;
  onerror: Listener | null = null;
  onopen: Listener | null = null;

  constructor(url: string) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const held = this.listeners.get(type) ?? new Set<Listener>();
    held.add(listener);
    this.listeners.set(type, held);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  /** Hand an event to both listener shapes the API admits — `addEventListener` and `on<type>`. */
  dispatch(type: string, event: Event): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    const direct = (this as unknown as Record<string, unknown>)[`on${type}`];
    if (typeof direct === "function") (direct as Listener).call(this, event);
  }

  /** One named frame, carrying its JSON exactly as the route publishes it. */
  emit(type: string, payload: unknown): void {
    this.dispatch(type, new MessageEvent(type, { data: JSON.stringify(payload) }));
  }

  /** The stream giving up before a terminal frame. */
  fail(): void {
    this.dispatch("error", new Event("error"));
  }

  /** The one instance opened, asserted to be exactly one. */
  static only(why: string): FakeEventSource {
    expect(FakeEventSource.instances.length, why).toBe(1);
    return FakeEventSource.instances[0] as FakeEventSource;
  }
}

/** Arm the stream leg for this test. */
export function installEventSource(): typeof FakeEventSource {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  return FakeEventSource;
}

/** The condition the poll leg is chosen under, asserted rather than assumed. */
export function expectNoEventSource(): void {
  expect(
    typeof (globalThis as { EventSource?: unknown }).EventSource,
    "jsdom publishes no EventSource, so the watch falls to the poll",
  ).not.toBe("function");
}

export interface PollAnswer {
  status: number;
  body: unknown;
}

/** A fetch that answers the queue in order and repeats its last answer afterwards. */
export function answering(queue: readonly (PollAnswer | "reject")[]): ReturnType<typeof vi.fn> {
  let at = 0;
  return vi.fn(async () => {
    const answer = queue[Math.min(at, queue.length - 1)];
    at += 1;
    if (answer === "reject" || answer === undefined) throw new TypeError("the network is gone");
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  });
}

/** The calls that asked the events route about one job, whatever else the page fetched. */
export function pollsFor(fetched: ReturnType<typeof vi.fn>, jobId: string): unknown[][] {
  return fetched.mock.calls.filter((call) => String(call[0]).includes(`jobId=${encodeURIComponent(jobId)}`));
}
