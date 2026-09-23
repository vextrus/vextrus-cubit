// How the database lane runs its suites: the batch in parallel, and the suite that REWRITES TRACKED
// SOURCE alone, after it (V-DB, session 7).
//
// drift-lane-breaker proves the schema-drift lane cannot exit 0 over drift by mutating the seam in
// place. It renames `tenants.name` in `src/core/db/schema-tenants.ts` (valid TypeScript), then writes
// a barrel drizzle-kit cannot load, and restores both. It holds the drift lock while it does, but a
// lock only serialises the readers that take it. Every suite that imports the schema reads the seam
// when its module graph loads, and at eight workers that load can land inside the window.
// Session 7 saw both halves of that in one day:
// - the shared acceptance build compiled the renamed column and served 500 on every page
//   (sheets/route-render; 21e0e6d5 put the build under the lock);
// - then members-live's own staging imported it in-process and inserted into `tenants.title`.
// Locking every importer would serialise the lane. Running the one mutating suite alone means no
// other suite is loading while the seam is wrong. The lane's include is unchanged (the partition
// proof in tests/toolchain/test-lane-split.test.ts still holds), and the order is the runner's.

/** The suites that rewrite tracked source, each run alone after the batch. */
export const SOURCE_MUTATING_SUITES = Object.freeze(["db/__tests__/drift-lane-breaker.test.ts"]);

/** Flags whose value is the next argument, so the value is never read as a file filter. */
const VALUED_FLAGS = new Set(["--config", "-c", "--reporter", "--outputFile", "-t", "--testNamePattern", "--maxWorkers", "--project", "--exclude", "--root", "--dir"]);

/**
 * Whether the arguments name files or filters of their own. A run that names them asked for exactly
 * those suites, and it is run as asked, in one pass.
 * @param {ReadonlyArray<string>} args
 * @returns {boolean}
 */
export function namesSuites(args) {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument.startsWith("-")) {
      if (!argument.includes("=") && VALUED_FLAGS.has(argument)) index += 1;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * The vitest argument lists this lane runs, in order: the whole lane minus the source-mutating
 * suites, then each of those alone. A run naming its own suites is one pass, unchanged.
 * @param {ReadonlyArray<string>} args the arguments the lane was given (the config among them)
 * @returns {string[][]}
 */
export function dbPasses(args) {
  if (namesSuites(args)) return [[...args]];
  const batch = [...args, ...SOURCE_MUTATING_SUITES.flatMap((suite) => ["--exclude", suite])];
  return [batch, ...SOURCE_MUTATING_SUITES.map((suite) => [...args, suite])];
}
