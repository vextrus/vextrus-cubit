// The factory trailers of one commit message, by docs/specs/factory/contracts/trailers.md 1: the one reading every
// consumer makes. scripts/factory/trailers.py is the same reading in Python (the watcher's); the stop gate imports
// this module; the guard, being self-contained, carries the block between the markers byte for byte
// (trailers.extra.test.mjs compares them; scripts/factory/tests/test_trailers.py runs one table through both).

// --- trailer reader: begin (copied verbatim into guard.mjs)
/**
 * The factory trailers of one message: { outcome, reason, why, gated }, outcome "READY", "BLOCKED", "READY-NO-VERIFY"
 * (a malformed READY, or a factory line the reading does not take) or null. The read paragraph is the last paragraph
 * holding a `Factory-*` line (or a loose `factory state:` line) among the last two; such a line in any other paragraph
 * is READY-NO-VERIFY ("factory trailer not in the last paragraph"). `gated`: a READY-looking `Factory-State` line in the
 * last two paragraphs, which the guard's push gate and the stop gate treat as READY (and, on a head not READY, is
 * READY-NO-VERIFY). ASCII classes and `\n` splits only, written to agree with the Python reader on every input.
 */
function readTrailers(message, tree) {
  const WS_CHARS = " \\t\\v\\f\\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
  const WS = `[${WS_CHARS}]`;
  const NOT_BLANK = new RegExp(`[^\\n${WS_CHARS}]`); // a paragraph of whitespace alone is no paragraph
  const TRAILER = /^([A-Za-z0-9-]+):[ \t]*([^\n]*?)[ \t]*$/;
  const LOOSE_STATE = new RegExp(`^${WS}*factory[-_ ]?state${WS}*:${WS}*([^\\n]*)$`, "i");
  const KEYS = new Set(["factory-state", "factory-verify", "factory-reason"]);
  const isFactory = (line) => {
    const m = TRAILER.exec(line);
    return (m !== null && m[1].toLowerCase().startsWith("factory-")) || LOOSE_STATE.test(line);
  };
  const looksReady = (line) => {
    const m = LOOSE_STATE.exec(line);
    return m !== null && /ready/i.test(m[1]);
  };
  const result = (outcome, reason = null, why = null, gated = false) => ({ outcome, reason, why, gated });
  const core = (lines) => {
    const found = new Map();
    for (const line of lines) {
      const m = TRAILER.exec(line);
      if (m === null || !m[1].toLowerCase().startsWith("factory-")) continue;
      const key = m[1].toLowerCase();
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(m[2]);
    }
    if (found.size === 0) return result(null);
    if ([...found.values()].some((values) => values.length > 1)) return result(null, null, "a factory trailer is repeated");
    if ([...found.keys()].some((key) => !KEYS.has(key))) return result(null, null, "an unknown factory trailer");
    if (!found.has("factory-state")) return result(null, null, "factory trailers without Factory-State");
    const state = found.get("factory-state")[0];
    const verify = found.get("factory-verify")?.[0] ?? null;
    const reason = found.get("factory-reason")?.[0] ?? null;
    const verifyOk = verify === null || /^[0-9a-f]{40} ok$/.test(verify);
    if (state === "READY") {
      if (reason !== null) return result(null, null, "READY carries a Factory-Reason");
      if (verify === null) return result(null, null, "no Factory-Verify");
      if (!verifyOk) return result(null, null, "Factory-Verify is malformed");
      if (verify.slice(0, 40) !== tree) return result(null, null, "the Factory-Verify tree is not the head's tree");
      return result("READY");
    }
    if (state === "BLOCKED") {
      if (reason === null || !/^[^\r\n]{1,200}$/u.test(reason) || !verifyOk) return result(null, null, "BLOCKED without a one-line Factory-Reason");
      return result("BLOCKED", reason);
    }
    return result(null, null, "Factory-State is not READY or BLOCKED");
  };

  const paragraphs = message
    .replace(/\r/g, "")
    .split(/\n[ \t]*\n/)
    .filter((p) => NOT_BLANK.test(p))
    .map((p) => p.split("\n"));
  const holds = paragraphs.map((lines) => lines.some(isFactory));
  const lastTwo = [paragraphs.length - 1, paragraphs.length - 2].filter((i) => i >= 0);
  const readAt = lastTwo.find((i) => holds[i]) ?? -1;
  const gated = lastTwo.some((i) => paragraphs[i].some(looksReady));
  if (holds.some((held, i) => held && i !== readAt)) return result("READY-NO-VERIFY", null, "factory trailer not in the last paragraph", gated);
  const found = core(readAt < 0 ? [] : paragraphs[readAt]);
  if (found.outcome === "READY" || !gated) return result(found.outcome, found.reason, found.why, gated);
  return result("READY-NO-VERIFY", null, found.why ?? "a READY-looking Factory-State line outside the factory trailers", gated);
}
// --- trailer reader: end

export { readTrailers };
