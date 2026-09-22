// The ports the tree binds, named once (ARCH-02): the product's own port, the journey runner's, and
// the demo's. They are stated here, not discovered from the environment — a machine check whose
// verdict an environment variable can move is not a check of this tree (C-06, B-23). An environment
// variable may point a run at a different port, but it can never leave the set empty.
//
// This file is the ONLY place a served port is spelled (tests/toolchain/ports-one-home.test.ts reads
// the scripts, the Playwright config and the journeys for a second spelling). The gate, the checkup,
// the dev lane, the probe and the journeys' server all ask `portFor`/`servedPorts`/`originFor`.
//
// 3212 is taken and is NOT named here: the dev lane's worker answers health on the app port + 2
// (scripts/dev.mjs), so it moves with `--port`. The demo therefore sits on 3213.

/** The port the product serves on, the port the journeys drive, and the port the demo serves on. */
export const PORTS = Object.freeze({
  app: 3210,
  e2e: 3211,
  demo: 3213,
});

/** The one environment name that may move each port. */
const OVERRIDES = Object.freeze({
  app: "PORT",
  e2e: "E2E_PORT",
  demo: "DEMO_PORT",
});

/**
 * @param {keyof typeof PORTS} which
 * @returns {number}
 */
export function portFor(which) {
  const override = Number(process.env[OVERRIDES[which]] ?? "");
  return Number.isInteger(override) && override > 0 ? override : PORTS[which];
}

/**
 * Every port a served product may hold — the dev lane's, the journeys' and the demo's — as this run
 * resolves them. The db lane never runs while any of them is held (V-DB).
 * @returns {number[]}
 */
export function servedPorts() {
  return [portFor("app"), portFor("e2e"), portFor("demo")];
}

/**
 * Where a served port answers. Always 127.0.0.1, never `localhost`: Windows resolves `localhost` to
 * ::1 first, and under WSL2 mirrored networking a dial to an unbound loopback port hangs rather than
 * being refused.
 * @param {keyof typeof PORTS} which
 * @returns {string}
 */
export function originFor(which) {
  return `http://127.0.0.1:${portFor(which)}`;
}
