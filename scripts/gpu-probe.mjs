#!/usr/bin/env node
// WHAT PAINTS THE VIEWER'S CANVAS? — the probe that answers it by asking the browser (v22 speed-gpu).
//
// Headless Chromium on WSL2 falls back to SwiftShader (a CPU rasteriser) for WebGL unless it is
// told, by flag AND by environment, which hardware path to take. This machine HAS one: /dev/dxg is
// the WSL2 GPU device, /usr/lib/wsl/lib/libd3d12.so is the host driver's D3D12 shim, and Mesa's
// d3d12 Gallium driver turns GL into D3D12 calls against it. The question "does a flag set reach
// the RTX 3060 Ti" has exactly one honest answer — the string the GL context itself reports — so
// this script launches each candidate, reads UNMASKED_RENDERER_WEBGL out of a live WebGL2 context,
// and times a spinning triangle for one second. A renderer string with "SwiftShader" in it is the
// CPU; anything naming D3D12/NVIDIA/ANGLE-over-hardware is not.
//
// Run: node scripts/gpu-probe.mjs [--json] [--only <id>]
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";

/** The WSL2 GPU device. Its absence means there is no hardware path to try, whatever the flags say. */
export const DXG_DEVICE = "/dev/dxg";

/**
 * The environment Mesa's d3d12 Gallium driver needs to pick the discrete adapter rather than the
 * first one it finds — and the one variable that must be ABSENT, because its presence forces llvmpipe.
 */
export const D3D12_ENV = {
  MESA_D3D12_DEFAULT_ADAPTER_NAME: "NVIDIA",
  GALLIUM_DRIVER: "d3d12",
  MESA_LOADER_DRIVER_OVERRIDE: "d3d12",
  LIBGL_ALWAYS_SOFTWARE: undefined,
};

/**
 * THE HARDWARE FLAGS. `--ozone-platform=x11` is the load-bearing one: it is what makes Chromium ask
 * EGL for an X11 display (WSLg serves one at :0) rather than the surfaceless display that has no
 * device behind it here. `--use-angle=gl` then puts ANGLE on top of Mesa's desktop GL, which the
 * env below points at the d3d12 Gallium driver, which talks to /usr/lib/wsl/lib/libd3d12.so and so
 * to the card. Dropping any one of the three lands back on a CPU rasteriser.
 */
export const HARDWARE_ARGS = ["--ozone-platform=x11", "--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"];

/**
 * The candidates, in the order a reader should judge them: the baseline first, the control last,
 * and — after the first run of this probe answered SwiftShader ten times out of ten — the three
 * that follow from WHY it did. Mesa's d3d12 driver reaches the card only through a winsys that has
 * a display behind it (`eglinfo` answers `D3D12 (NVIDIA GeForce RTX 3060 Ti)` on the X11 and
 * Wayland platforms and fails to initialise on GBM and surfaceless), and headless Chromium asks
 * EGL for a SURFACELESS display because this box has no /dev/dri render node at all. So the last
 * three name an ozone platform and a window, which is the only shape in which the flags can land.
 */
export const CANDIDATES = [
  { id: "a-none", args: [], env: {}, note: "baseline — no GL flag at all" },
  {
    id: "b-egl-d3d12",
    args: ["--use-gl=egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
    env: D3D12_ENV,
    note: "native EGL onto Mesa d3d12",
  },
  {
    id: "c-angle-gl",
    args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
    env: D3D12_ENV,
    note: "ANGLE over desktop GL onto Mesa d3d12",
  },
  {
    id: "d-angle-vulkan",
    args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"],
    env: {},
    note: "ANGLE over Vulkan — there is no dzn ICD installed, so this can only find lavapipe",
  },
  {
    id: "e-swiftshader",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    env: {},
    note: "the control — today's j-011 spelling",
  },
  {
    id: "f-x11-angle-gl",
    args: [...HARDWARE_ARGS],
    env: D3D12_ENV,
    headed: true,
    note: "THE WINNER — a window on WSLg's X11, ANGLE over Mesa d3d12",
  },
  {
    id: "g-x11-angle-gl-noenv",
    args: [...HARDWARE_ARGS],
    env: {},
    headed: true,
    note: "the same window without the Mesa env — proves the env is what picks the card over llvmpipe",
  },
  {
    id: "h-x11-headless-new",
    args: ["--headless=new", ...HARDWARE_ARGS],
    env: D3D12_ENV,
    note: "the same flags with no window — proves the window, not the flags, is what was missing",
  },
];

/** The two binaries Playwright ships: the headless shell (its default) and the full browser. */
export const BINARIES = [
  { id: "shell", channel: undefined, note: "chromium_headless_shell" },
  { id: "full", channel: "chromium", note: "full chromium" },
];

/** A page that builds a WebGL2 context, names its renderer, and spins a triangle for a second. */
const HARNESS = `<!doctype html><html><body style="margin:0"><canvas id=c width=640 height=480></canvas><script>
window.__probe = (async () => {
  const c = document.getElementById("c");
  const gl = c.getContext("webgl2");
  if (!gl) return { webgl2: false, renderer: "(no webgl2 context)", vendor: "", fps: 0 };
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, "#version 300 es\\nin vec2 p; uniform float t; void main(){ float s=sin(t),co=cos(t); gl_Position=vec4(p.x*co-p.y*s, p.x*s+p.y*co, 0.0, 1.0); }");
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, "#version 300 es\\nprecision mediump float; out vec4 o; void main(){ o=vec4(0.2,0.7,1.0,1.0); }");
  gl.compileShader(fs);
  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { webgl2: true, renderer, vendor, fps: 0, link: gl.getProgramInfoLog(pr) };
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0.8, -0.8,-0.8, 0.8,-0.8]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tl = gl.getUniformLocation(pr, "t");
  // The triangle is drawn many times per frame so the FRAME is GPU-bound rather than clock-bound:
  // a rAF loop that draws once measures the compositor's tick (~60/s everywhere) and says nothing
  // about the rasteriser. 400 draws per frame separates a CPU rasteriser from silicon.
  let frames = 0;
  const start = performance.now();
  await new Promise((done) => {
    const tick = () => {
      for (let i = 0; i < 400; i++) { gl.uniform1f(tl, (frames + i) * 0.01); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.finish();
      frames++;
      if (performance.now() - start >= 1000) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const secs = (performance.now() - start) / 1000;
  return { webgl2: true, renderer, vendor, fps: frames / secs, draws: Math.round((frames * 400) / secs) };
})();
</script></body></html>`;

/**
 * WHAT DOES THIS BROWSER SAY IT IS? — the one home for the question (ARCH-02).
 *
 * The flags are a REQUEST; this string is the answer, and the two part company silently — a missing
 * DISPLAY, an `LIBGL_ALWAYS_SOFTWARE` inherited from a shell, a Mesa upgrade. When they part, the
 * only symptom is a viewer journey that got slower, which reads as flake rather than as a fact. So
 * both callers ask rather than claim: this script's table, and the journey lane's global setup,
 * which prints one `gpu:` line per run from exactly the options every journey will launch under.
 *
 * It never throws. A probe that cannot answer says so in the string it returns; the lane's GL choice
 * is already a floor (software), and a run that would otherwise walk is not stopped by a diagnostic.
 *
 * @param {{ channel?: string, headless?: boolean, args?: readonly string[], env?: Record<string, string> }} options
 * @returns {Promise<string>} the unmasked WebGL renderer, or a parenthesised reason it is unknown
 */
export async function readRenderer(options) {
  let browser;
  try {
    browser = await chromium.launch({
      channel: /** @type {any} */ (options.channel),
      headless: options.headless ?? true,
      args: [...(options.args ?? [])],
      ...(options.env ? { env: /** @type {any} */ (options.env) } : {}),
      timeout: 60_000,
    });
    const page = await browser.newPage();
    await page.setContent("<canvas id=c></canvas>");
    return await page.evaluate(() => {
      const canvas = /** @type {HTMLCanvasElement} */ (/** @type {any} */ (globalThis).document.getElementById("c"));
      const gl = canvas.getContext("webgl2");
      if (!gl) return "(no webgl2 context)";
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
  } catch (error) {
    return `(unreadable: ${(String(error).split("\n")[0] ?? "").slice(0, 120)})`;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** chrome://gpu's own verdict, read through CDP — the browser's answer about itself. */
/** @param {import("@playwright/test").Browser} browser */
async function gpuFeatureStatus(browser) {
  try {
    const session = await browser.newBrowserCDPSession();
    const info = /** @type {any} */ (await session.send(/** @type {any} */ ("SystemInfo.getInfo")));
    await session.detach();
    const gpu = info?.gpu ?? {};
    const device = (gpu.devices ?? []).map((/** @type {any} */ d) => d.deviceString || `${d.vendorId}:${d.deviceId}`).join(", ");
    const status = gpu.auxAttributes?.glRenderer ?? "";
    return { device, glRenderer: status, driver: (gpu.devices ?? [])[0]?.driverVersion ?? "" };
  } catch (err) {
    return { device: `(SystemInfo unavailable: ${String(err).slice(0, 60)})`, glRenderer: "", driver: "" };
  }
}

/** The environment a candidate launches under: this process's, plus its own, minus the unset ones. */
/** @param {{ env: Record<string, string | undefined> }} candidate */
export function launchEnv(candidate) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(candidate.env)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

/** Is this renderer string a CPU rasteriser? The one reading of the question the whole lane turns on. */
/** @param {string} renderer */
export const isSoftwareRenderer = (renderer) =>
  !renderer || /swiftshader|llvmpipe|software|softwarerasterizer/i.test(renderer);

/** @param {any} candidate @param {any} binary */
async function probe(candidate, binary) {
  const row = { candidate: candidate.id, binary: binary.id, note: candidate.note };
  let browser;
  try {
    browser = await chromium.launch({
      channel: candidate.headed ? "chromium" : binary.channel,
      headless: !candidate.headed,
      args: candidate.args,
      env: /** @type {any} */ (launchEnv(candidate)),
      timeout: 60_000,
    });
    const sys = await gpuFeatureStatus(browser);
    const page = await browser.newPage();
    await page.setContent(HARNESS);
    const result = /** @type {any} */ (await page.evaluate(() => /** @type {any} */ (globalThis)["__probe"]));
    return { ...row, ...result, ...sys, ok: true };
  } catch (err) {
    return { ...row, ok: false, renderer: `LAUNCH FAILED: ${(String(err).split("\n")[0] ?? "").slice(0, 90)}`, vendor: "", webgl2: false, fps: 0 };
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function main() {
  const json = process.argv.includes("--json");
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt === -1 ? null : process.argv[onlyAt + 1];
  process.stderr.write(`${DXG_DEVICE}: ${existsSync(DXG_DEVICE) ? "present" : "ABSENT"}\n`);
  const rows = [];
  for (const binary of BINARIES) {
    for (const candidate of CANDIDATES) {
      if (only && candidate.id !== only) continue;
      // A headed candidate is the FULL binary by construction — the headless shell has no window —
      // so it is probed once rather than twice, under the binary that can actually run it.
      if (candidate.headed && binary.id !== "full") continue;
      const row = await probe(candidate, binary);
      rows.push(row);
      if (!json) {
        process.stdout.write(
          `${row.candidate.padEnd(16)} ${row.binary.padEnd(6)} webgl2=${String(row.webgl2).padEnd(5)} ` +
            `fps=${(row.fps ?? 0).toFixed(1).padStart(6)} draws/s=${String(row.draws ?? 0).padStart(8)} ` +
            `hw=${!isSoftwareRenderer(row.renderer)} :: ${row.renderer}\n`,
        );
        if (row.device) process.stdout.write(`${"".padEnd(23)}   gpu-device: ${row.device} ${row.driver}\n`);
      }
    }
  }
  if (json) process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("gpu-probe.mjs")) await main();
