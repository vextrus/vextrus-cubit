// C-06's system-tool pins, and the one place their shape is read (ARCH-02).
//
// The Bible pins Typst by version AND sha256 (`docs/specs/cubit.bible.xml`, the stack element, and
// AM-08: "pinned by version + sha256 … in package.json's C-06 toolchain block and refused by pnpm
// checkup on drift"). Until now `package.json` held the version alone and `checkup` compared only
// what the binary would say about itself — so the sha256 half of the pin was enforced by nothing,
// and a rebuilt or patched binary reporting the same version passed. R-SPINE-040 makes that gap
// load-bearing: byte-identical document output is a promise about a renderer BUILD, not a version
// string, and a version string is exactly what a different build can keep.
//
// So a pin is either a bare version (uv: nothing downstream depends on its bytes) or a version with
// a digest (typst). The functions here are pure so the law can be tested without a machine.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * @typedef {{version: string, sha256: string | null}} ToolPin
 */

/**
 * The pin C-06 states for a tool, in either shape.
 * @param {unknown} manifest the parsed package.json
 * @param {string} tool
 * @returns {ToolPin}
 */
export function toolPin(manifest, tool) {
  const tools = /** @type {{cubit?: {tools?: Record<string, unknown>}}} */ (manifest).cubit?.tools ?? {};
  const pin = tools[tool];
  if (pin === undefined) throw new Error(`package.json states no pin for ${tool} — C-06 pins Node, pnpm, uv and typst`);
  if (typeof pin === "string") return { version: pin, sha256: null };
  const { version, sha256 } = /** @type {{version?: unknown, sha256?: unknown}} */ (pin);
  if (typeof version !== "string" || version === "") throw new Error(`package.json's pin for ${tool} states no version`);
  if (sha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(sha256))) throw new Error(`package.json's sha256 pin for ${tool} is not a 64-hex digest`);
  return { version, sha256: sha256 === undefined ? null : String(sha256) };
}

/**
 * Where a tool resolves on PATH — `which`, asked the way a shell asks it.
 * @param {string} tool
 * @returns {string | null}
 */
export function toolPath(tool) {
  const result = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8", timeout: 20_000 });
  const found = (result.stdout ?? "").trim();
  return result.status === 0 && found !== "" ? found : null;
}

/**
 * The sha256 of a file, or null when it cannot be read — the digest `sha256sum` would print.
 * @param {string} path
 * @returns {string | null}
 */
export function fileDigest(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

/**
 * The verdict on one pinned tool: the version must match, and where the pin carries a digest the
 * bytes on PATH must match it too. Drift in either half is a refusal, never a warning (AM-08).
 * @param {{tool: string, pin: ToolPin, version: string | null, path?: string | null, digest?: string | null}} found
 * @returns {{ok: boolean, detail: string}}
 */
export function toolVerdict(found) {
  const { tool, pin, version } = found;
  const versionOk = version === pin.version;
  if (pin.sha256 === null) return { ok: versionOk, detail: `${tool} ${version ?? "absent"} (pin ${pin.version})` };
  const path = found.path ?? null;
  const digest = found.digest ?? null;
  const digestOk = digest !== null && digest === pin.sha256;
  const where = path === null ? "not on PATH" : path;
  const said = digest === null ? "unreadable" : `${digest.slice(0, 8)}…`;
  return {
    ok: versionOk && digestOk,
    detail: `${tool} ${version ?? "absent"} (pin ${pin.version}) sha256 ${said} (pin ${pin.sha256.slice(0, 8)}…) at ${where}${digestOk ? "" : " — DRIFT"}`,
  };
}
