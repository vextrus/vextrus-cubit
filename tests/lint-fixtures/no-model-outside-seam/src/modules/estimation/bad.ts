// L-AI-01: callModel() in src/core/model is the only path to a model. Every shape that reaches a
// provider SDK — straight, bare, template-literal, hoisted, require, computed require, createRequire,
// `import x = require()`, and a re-export in both spellings — and every deep import into the seam's
// interior is refused outside the seam directory.
import Anthropic from "@anthropic-ai/sdk"; // RECORDED REASON L-AI-01
import OpenAI from "openai"; // RECORDED REASON L-AI-01
import type { LanguageModel } from "@ai-sdk/provider"; // RECORDED REASON L-AI-01
import { createRequire } from "node:module";

import { transport } from "../../core/model/transport"; // RECORDED REASON L-AI-01

const sdk = "openai";

const streamed = await import(`ai`); // RECORDED REASON L-AI-01
const hoisted = await import(sdk); // RECORDED REASON L-AI-01
const required: unknown = require("openai"); // RECORDED REASON L-AI-01
const computed: unknown = globalThis["require"]("openai"); // RECORDED REASON L-AI-01
const indirect: unknown = createRequire(import.meta.url)("openai"); // RECORDED REASON L-AI-01
import equals = require("openai"); // RECORDED REASON L-AI-01

export { transport as reachedTransport } from "../../core/model/transport"; // RECORDED REASON L-AI-01
export * from "@mistralai/mistralai"; // RECORDED REASON L-AI-01

export const reached = { Anthropic, OpenAI, transport, streamed, hoisted, required, computed, indirect, equals };
export type Model = LanguageModel;
