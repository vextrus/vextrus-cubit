/**
 * Types for the verify roster, so the tree's own TypeScript suite can read the real roster
 * and drive the real line grammar (tests/toolchain/verify.test.ts). The implementation is
 * verify-roster.mjs; allowJs is off, so the shape is declared here.
 */

/** What a stage said for itself, and whether it passed. */
export interface StageOutcome {
  readonly ok: boolean;
  readonly output: string;
}

/** One roster stage: a command, or a check that is a comparison rather than an exit code. */
export interface Stage {
  readonly name: string;
  /** The directory whose absence skips the stage (C-06). Absent means always armed. */
  readonly input?: string;
  readonly file?: string | null;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly unwired?: string;
  readonly run?: () => StageOutcome | Promise<StageOutcome>;
}

/** What runRoster prints and how it reaches the world. */
export interface RosterIo {
  readonly say: (line: string) => void;
  readonly detail: (text: string) => void;
  readonly isArmed?: (input: string) => boolean;
  readonly run?: (stage: Stage) => StageOutcome | Promise<StageOutcome>;
  readonly now?: () => number;
}

export declare const STAGES: readonly Stage[];
export declare function runStage(stage: Stage): StageOutcome | Promise<StageOutcome>;
export declare function runRoster(stages: readonly Stage[], io: RosterIo): Promise<number>;
