// L-AI-01, B-23: which transport a seam runs over is read off the environment it is handed, never
// off a flag somebody froze. A fixture root names the fixture transport; the test environment
// implies one under the tree's own fixture directory; anything else is the live provider.
import { resolve } from "node:path";

/** The environment as a seam reads it — a record, so acceptance can hand one in (I-E). */
export type ModelEnv = Readonly<Record<string, string | undefined>>;

/** The chosen transport, and for fixtures the resolved root the answers are read from. */
export type SelectedTransport = { transport: "live" } | { transport: "fixture"; fixtureRoot: string };

/** The directory recorded answers live in when the environment names none (F-MODEL). */
const defaultFixtureRoot = (): string => resolve(process.cwd(), "fixtures", "model");

/**
 * Fixture iff `CUBIT_MODEL_FIXTURE_ROOT` is a non-blank path (resolved) or the process is under test
 * (the default root); live otherwise. Both names are declared in the transport vocabulary (Q-07).
 */
export function selectTransport(env: ModelEnv): SelectedTransport {
  const configured = env.CUBIT_MODEL_FIXTURE_ROOT;
  if (typeof configured === "string" && configured.trim() !== "") {
    return { transport: "fixture", fixtureRoot: resolve(configured) };
  }
  if (env.NODE_ENV === "test") return { transport: "fixture", fixtureRoot: defaultFixtureRoot() };
  return { transport: "live" };
}
