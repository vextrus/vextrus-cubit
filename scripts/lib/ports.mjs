// The ports the tree binds, named once (ARCH-02): the product's own port and the journey runner's.
// They are stated here, not discovered from the environment — a machine check whose verdict an
// environment variable can move is not a check of this tree (C-06, B-23). An environment variable
// may point a run at a different port, but it can never leave the set empty.

/** The port the product serves on, and the port the journeys drive. */
export const PORTS = Object.freeze({
  app: 3210,
  e2e: 3211,
});

/**
 * @param {keyof typeof PORTS} which
 * @returns {number}
 */
export function portFor(which) {
  const override = Number(process.env[which === "app" ? "PORT" : "E2E_PORT"] ?? "");
  return Number.isInteger(override) && override > 0 ? override : PORTS[which];
}
