// The `cubit` MCP server (.mcp.json): four instruments a session reaches for often, whose Bash
// spellings were where sessions went wrong — a read-back whose SQL a shell's quoting broke, a live
// Jev question that had to carry the key through a command line, a professional drawing nobody could
// look at closely. Each tool is a door with the law built in rather than a rule to remember:
//
//   db_read            read-only SQL over cubit_e2e or cubit_dev through psql (the seam's driver stays the
//                      seam's), `cubit.system_reason` set, scoped to one project by `:'pid'` unless
//                      unscoping is asked for by name, refused while the db lane runs
//   jev_ask            one TypeSafe Jev System One request, the model pinned to the product's own id
//                      (D-002), the key read from the environment and never echoed, the cost derived
//                      by the product's one derivation (`modelCallCost`) and appended to a harness ledger
//   drawing_inventory  what a DWG/DXF holds (scripts/harness/drawing.py), converted by the product's
//                      own audited DWG lane
//   drawing_render     one layout or window of a drawing, painted to PNG for a close look
//
// Plain JSON-RPC over stdio (newline-delimited, MCP's stdio transport), no SDK: the server is small,
// and this public repository gains no dependency for it. Started with tsx, so it imports the
// product's own constants rather than spelling them twice (ARCH-02).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { devDatabaseUrl, e2eDatabaseUrl } from "../lib/pg-database.mjs";
import { JEV_MODEL as TYPESAFE_MODEL, TYPESAFE_ENDPOINT } from "../../src/core/model";
import { modelCallCost } from "../../src/core/model-ledger.types";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const HARNESS_CACHE = join(ROOT, "node_modules", ".cache", "cubit", "harness");
const PRIVATE_WORK = join(ROOT, ".private", "work");

/** @param {string} text */
const textResult = (text, isError = false) => ({ content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) });

// ---------------------------------------------------------------------------------------------
// db_read

const READ_ONLY_START = /^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(select|with|explain|table|values)\b/i;

/** @param {string} sql */
function oneStatement(sql) {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  // A semicolon inside a string literal is allowed; one between statements is not.
  const outsideStrings = trimmed.replace(/'(?:[^']|'')*'/g, "''");
  return outsideStrings.includes(";") ? null : trimmed;
}

function dbLaneRunning() {
  const result = spawnSync("pgrep", ["-f", "scripts/db-test.mjs|db/__tests__/vitest.config"], { encoding: "utf8" });
  return result.status === 0 && result.stdout.trim() !== "";
}

/** @param {string} value */
function cell(value) {
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

/** @param {{ sql: string, reason: string, project_id?: string, unscoped?: boolean, database?: "e2e" | "dev", max_rows?: number }} args */
function dbRead(args) {
  const statement = oneStatement(String(args.sql ?? ""));
  if (statement === null) return textResult("REFUSED db_read: one statement per call.", true);
  if (!READ_ONLY_START.test(statement)) return textResult("REFUSED db_read: a read begins SELECT, WITH, EXPLAIN, TABLE or VALUES (the transaction is READ ONLY either way).", true);
  const reason = String(args.reason ?? "").trim();
  if (reason.length < 8) return textResult("REFUSED db_read: say why you read (reason), as runAsSystem records it.", true);
  const project = args.project_id === undefined ? null : String(args.project_id);
  if (project !== null && !/^[0-9a-f-]{36}$/i.test(project)) return textResult("REFUSED db_read: project_id is a project's UUID.", true);
  if (project !== null && !/:'pid'/.test(statement)) return textResult("REFUSED db_read: project_id is bound as :'pid' and the SQL must use it (SCOPE every query: the database holds every earlier run).", true);
  if (project === null && args.unscoped !== true) return textResult("REFUSED db_read: pass project_id and scope the SQL with :'pid', or unscoped: true for a query that finds the project itself.", true);
  if (dbLaneRunning()) return textResult("REFUSED db_read: the db lane is running on this cluster; read after it ends.", true);
  const url = args.database === "dev" ? devDatabaseUrl() : e2eDatabaseUrl();
  const limit = Math.min(Math.max(Number(args.max_rows ?? 100), 1), 1000);
  const variables = ["-v", `reason=${reason}`, ...(project === null ? [] : ["-v", `pid=${project}`])];
  const script = `begin read only;\nselect set_config('cubit.system_reason', :'reason', true) \\g /dev/null\n${statement};\ncommit;\n`;
  const result = spawnSync("psql", [url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-A", "-F", "\t", "-P", "footer=off", ...variables], {
    input: script,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) return textResult(`db_read failed: ${(result.stderr ?? "").trim().slice(-3000)}`, true);
  const lines = result.stdout.split("\n").filter((line) => line !== "");
  const [header = "", ...rows] = lines;
  const shown = rows.slice(0, limit).map((row) => row.split("\t").map(cell).join("\t"));
  const tail = rows.length > shown.length ? `\n... ${rows.length - shown.length} more row(s) not shown (max_rows ${limit})` : "";
  return textResult(`${rows.length} row(s) from cubit_${args.database === "dev" ? "dev" : "e2e"}${project === null ? " (UNSCOPED)" : ` scoped to ${project}`}\n${[header, ...shown].join("\n")}${tail}`);
}

// ---------------------------------------------------------------------------------------------
// jev_ask

/** @param {{ body: Record<string, unknown>, purpose: string }} args */
async function jevAsk(args) {
  const key = process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_AI_API_KEY?.trim();
  if (!key) return textResult("REFUSED jev_ask: TYPESAFE_API_KEY is not in this server's environment (the owner's ~/.bashrc exports it to the shell Claude Code was started from).", true);
  const body = args.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return textResult("REFUSED jev_ask: body is the request object the HTTP API documents (state, questions ...), without model.", true);
  if ("model" in body && body.model !== TYPESAFE_MODEL) return textResult(`REFUSED jev_ask: the model is pinned to ${TYPESAFE_MODEL} (D-002); leave model out.`, true);
  const purpose = String(args.purpose ?? "").trim();
  if (purpose.length < 8) return textResult("REFUSED jev_ask: say what the question is for (purpose); it rides the harness ledger with the cost.", true);
  const started = Date.now();
  let response;
  try {
    response = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: TYPESAFE_MODEL }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    return textResult(`jev_ask failed to reach ${TYPESAFE_ENDPOINT}: ${error instanceof Error ? error.message : String(error)}`, true);
  }
  const elapsedMs = Date.now() - started;
  const text = await response.text();
  if (!response.ok) return textResult(`jev_ask: ${response.status} ${response.statusText} after ${elapsedMs} ms\n${text.slice(0, 4000)}`, true);
  /** @type {any} */
  let answered;
  try {
    answered = JSON.parse(text);
  } catch {
    return textResult(`jev_ask: the provider answered a body that is not JSON\n${text.slice(0, 2000)}`, true);
  }
  const input = Number(answered?.usage?.input_tokens ?? 0);
  const output = Number(answered?.usage?.output_tokens ?? 0);
  const cost = modelCallCost(TYPESAFE_MODEL, input, output);
  mkdirSync(HARNESS_CACHE, { recursive: true });
  appendFileSync(
    join(HARNESS_CACHE, "jev-calls.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), purpose, questions: Object.keys(answered?.answers ?? {}), inputTokens: input, outputTokens: output, costUsd: cost, elapsedMs })}\n`,
  );
  return textResult(`jev_ask ${TYPESAFE_MODEL}: ${elapsedMs} ms, ${input} in / ${output} out tokens, $${cost} (ledger: node_modules/.cache/cubit/harness/jev-calls.jsonl)\n${JSON.stringify(answered, null, 2).slice(0, 12000)}`);
}

// ---------------------------------------------------------------------------------------------
// drawings

/**
 * @typedef {{ name: string, entities: number }} InventoryLayer
 * @typedef {{ scale_paper_per_model: number | null }} InventoryViewport
 * @typedef {{ name: string, entities: number, viewports: InventoryViewport[] }} InventoryLayout
 * @typedef {{ name: string, inserts: number, attribs: string[] }} InventoryBlock
 * @typedef {{ text: string, count: number, layer: string }} InventoryText
 * @typedef {{ file: string, dxfversion: string, insunits: number | null, measurement: number | null, extmin: number[], extmax: number[],
 *   spaces: Record<string, Record<string, number>>, layers: InventoryLayer[], layouts: InventoryLayout[], blocks: InventoryBlock[],
 *   dimensions: { count: number, overridden: number, styles: Record<string, number> }, textstyles: string[],
 *   text_heights: Record<string, number>, texts: InventoryText[], distinct_texts: number }} Inventory
 */

/**
 * @param {string} path
 * @returns {{ error: string } | { absolute: string, work: string }}
 */
function drawingPath(path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return { error: `no drawing at ${absolute}` };
  if (!/\.(dwg|dxf)$/i.test(absolute)) return { error: "a drawing is a .dwg or .dxf file" };
  const underPrivate = absolute.startsWith(`${join(ROOT, ".private")}/`);
  const work = underPrivate ? PRIVATE_WORK : join(HARNESS_CACHE, "drawings");
  mkdirSync(work, { recursive: true });
  return { absolute, work };
}

/**
 * @param {string[]} args
 * @returns {{ error: string } | { json: any }}
 */
function runDrawingTool(args) {
  const result = spawnSync("uv", ["run", "--project", "cad", "python", "scripts/harness/drawing.py", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 900_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) return { error: `drawing.py exited ${result.status}: ${(result.stderr ?? "").trim().slice(-2000)}` };
  return { json: JSON.parse(result.stdout) };
}

/** @param {{ path: string, texts?: number }} args */
function drawingInventory(args) {
  const target = drawingPath(String(args.path ?? ""));
  if ("error" in target) return textResult(`REFUSED drawing_inventory: ${target.error}`, true);
  const ran = runDrawingTool(["inventory", target.absolute, "--work", target.work]);
  if ("error" in ran) return textResult(ran.error, true);
  /** @type {Inventory} */
  const inv = ran.json;
  const saved = join(target.work, `${basename(target.absolute)}.inventory.json`);
  writeFileSync(saved, JSON.stringify(inv, null, 2));
  const texts = Math.min(Number(args.texts ?? 40), 120);
  const lines = [
    `${inv.file} · ${inv.dxfversion} · $INSUNITS ${inv.insunits} · $MEASUREMENT ${inv.measurement} · extents ${JSON.stringify(inv.extmin)}..${JSON.stringify(inv.extmax)}`,
    `spaces: ${Object.entries(inv.spaces).map(([name, census]) => `${name} ${JSON.stringify(census)}`).join(" | ")}`,
    `layers (${inv.layers.length}): ${inv.layers.slice(0, 40).map((layer) => `${layer.name}=${layer.entities}`).join(", ")}`,
    `layouts: ${inv.layouts.map((layout) => `${layout.name}(${layout.entities} entities, ${layout.viewports.length} viewports${layout.viewports.length ? ` scales ${[...new Set(layout.viewports.map((v) => v.scale_paper_per_model))].join("/")}` : ""})`).join("; ")}`,
    `blocks by inserts: ${inv.blocks.slice(0, 30).map((block) => `${block.name}×${block.inserts}${block.attribs.length ? `[${block.attribs.join(",")}]` : ""}`).join(", ")}`,
    `dimensions: ${inv.dimensions.count} (${inv.dimensions.overridden} with overridden text) · styles ${JSON.stringify(inv.dimensions.styles)}`,
    `text heights: ${JSON.stringify(inv.text_heights)} · text styles: ${inv.textstyles.join(", ")}`,
    `recurring texts (${inv.distinct_texts} distinct; top ${texts}): ${inv.texts.slice(0, texts).map((t) => `"${t.text}"×${t.count}@${t.layer}`).join(" · ")}`,
    `full inventory: ${relative(ROOT, saved)}`,
  ];
  return textResult(lines.join("\n"));
}

/** @param {{ path: string, layout?: string, box?: string, layers?: string, light?: boolean, width_px?: number }} args */
async function drawingRender(args) {
  const target = drawingPath(String(args.path ?? ""));
  if ("error" in target) return textResult(`REFUSED drawing_render: ${target.error}`, true);
  const stem = `${basename(target.absolute).replace(/\.[^.]+$/, "")}.${(args.layout ?? "Model").replace(/\W+/g, "_")}.${(args.box ?? "all").replace(/[^\d.-]+/g, "_")}`;
  const svg = join(target.work, "renders", `${stem}.svg`);
  const png = svg.replace(/\.svg$/, ".png");
  const toolArgs = ["render", target.absolute, "--work", target.work, "--out", svg, "--layout", String(args.layout ?? "Model")];
  if (args.box) toolArgs.push("--box", String(args.box));
  if (args.layers) toolArgs.push("--layers", String(args.layers));
  if (args.light !== false) toolArgs.push("--light");
  const ran = runDrawingTool(toolArgs);
  if ("error" in ran) return textResult(ran.error, true);
  const head = readFileSync(svg, "utf8").slice(0, 4000);
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(head)?.[1]?.trim().split(/\s+/).map(Number);
  const aspect = viewBox && viewBox[2] && viewBox[3] ? viewBox[3] / viewBox[2] : 0.7;
  const width = Math.min(Math.max(Number(args.width_px ?? 1800), 400), 4000);
  const height = Math.min(Math.round(width * aspect), 4000);
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    // The SVG is sized in millimetres; an image scaled into the viewport paints it at the PNG's size.
    const wrapper = svg.replace(/\.svg$/, ".html");
    writeFileSync(wrapper, `<!doctype html><body style="margin:0;background:white"><img src="${basename(svg)}" style="display:block;width:100vw;height:100vh;object-fit:contain"></body>`);
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`file://${wrapper}`, { timeout: 180_000, waitUntil: "load" });
    await page.screenshot({ path: png, timeout: 180_000 });
  } finally {
    await browser.close();
  }
  const bytes = readFileSync(png);
  const summary = `rendered ${ran.json.layout}${ran.json.box ? ` box ${ran.json.box.join(",")}` : ""} at ${width}x${height}px → ${relative(ROOT, png)} (${Math.round(bytes.length / 1024)} KB)`;
  if (bytes.length > 4 * 1024 * 1024) return textResult(`${summary}\nThe PNG is over 4 MB; Read it, or render a smaller box.`);
  return { content: [{ type: "text", text: summary }, { type: "image", data: bytes.toString("base64"), mimeType: "image/png" }] };
}

// ---------------------------------------------------------------------------------------------
// the protocol

const TOOLS = [
  {
    name: "db_read",
    description:
      "Read-only SQL against the journeys' database (cubit_e2e, default) or cubit_dev, with cubit.system_reason set. Pass project_id and use :'pid' in the SQL to scope it (the database holds every earlier run); unscoped: true only to find a project. One statement; READ ONLY transaction; refused while the db lane runs.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "One SELECT/WITH/EXPLAIN statement. :'pid' is project_id (psql's quoted variable)." },
        reason: { type: "string", description: "Why you read — recorded as the system reason." },
        project_id: { type: "string", description: "The project UUID, bound as :'pid'." },
        unscoped: { type: "boolean", description: "True only for a query that finds the project itself." },
        database: { type: "string", enum: ["e2e", "dev"] },
        max_rows: { type: "number", description: "Rows shown (default 100, max 1000)." },
      },
      required: ["sql", "reason"],
    },
  },
  {
    name: "jev_ask",
    description:
      "Put one request to TypeSafe Jev System One (the product's AI; closed questions: choice, noul, score). body is the HTTP API's request object without model; the model is pinned to the product's id. Returns the answers with probabilities, tokens and the cost the product's ledger would attribute. Read the typesafe-ai skill and the live docs before composing a body.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "object", description: "The request body (state, questions, ...), without model." },
        purpose: { type: "string", description: "What this question is for; logged with the cost." },
      },
      required: ["body", "purpose"],
    },
  },
  {
    name: "drawing_inventory",
    description:
      "What a DWG or DXF holds: header units, layers, entity census per space, blocks and inserts, layouts and viewport scales, dimension styles and overridden texts, recurring texts. A DWG is converted by the product's own audited lane. Use it on the owner's Edison set (.private/reference/edison/, never committed) and on this tree's fixtures.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative or absolute path to a .dwg/.dxf." },
        texts: { type: "number", description: "How many recurring texts to list (default 40)." },
      },
      required: ["path"],
    },
  },
  {
    name: "drawing_render",
    description:
      "Paint one layout (default Model) or one window of it (box = x0,y0,x1,y1 in drawing units, from drawing_inventory's extents) to PNG and return the image. Render a window, not a whole model sheet, to read text and dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        layout: { type: "string" },
        box: { type: "string", description: "x0,y0,x1,y1 in drawing units." },
        layers: { type: "string", description: "Comma-separated layers to paint (default all)." },
        light: { type: "boolean", description: "Black on white (default true); false paints in colour on black." },
        width_px: { type: "number", description: "PNG width (default 1800, max 4000)." },
      },
      required: ["path"],
    },
  },
];

const HANDLERS = { db_read: dbRead, jev_ask: jevAsk, drawing_inventory: drawingInventory, drawing_render: drawingRender };

/** @param {unknown} message */
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/** @param {any} message */
async function handle(message) {
  const { id, method, params } = message;
  if (method === "initialize") {
    return send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "cubit", version: "1.0.0" },
        instructions: "Vextrus Cubit's session instruments: db_read (scoped read-backs), jev_ask (live Jev), drawing_inventory and drawing_render (read a DWG/DXF closely).",
      },
    });
  }
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") {
    const handler = HANDLERS[/** @type {keyof typeof HANDLERS} */ (params?.name)];
    if (handler === undefined) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `no tool ${params?.name}` } });
    try {
      return send({ jsonrpc: "2.0", id, result: await handler(params?.arguments ?? {}) });
    } catch (error) {
      return send({ jsonrpc: "2.0", id, result: textResult(`${params?.name} failed: ${error instanceof Error ? error.message : String(error)}`, true) });
    }
  }
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (id !== undefined && id !== null) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (line.trim() === "") return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
  }
  void handle(message);
});
mkdirSync(dirname(HARNESS_CACHE), { recursive: true });
