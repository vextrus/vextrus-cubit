// The view-caption class, as Jev is asked it (R-TO-030, L-AI-01): one choice over the closed view
// vocabulary, on the request `@/core/view-captions` composes. The criteria are drawn from the
// vocabulary's one home (ARCH-02) and never spelled here.
import { VIEW_TYPE_SPELLINGS } from "../../errors/transport-vocabulary";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the view-caption request builder spells, sorted — what this arm is recognised by. */
const CAPTION_KEYS = ["caption", "key"] as const;

/** One silent caption, as recognised on a request: the text, and the entity key an answer cites. */
export type CaptionTask = { kind: "caption"; caption: string; key: string };

/** The view caption's arm: one closed choice, and a no-match outcome for a caption naming no class. */
export const viewCaptionArm: TypeSafeArm<CaptionTask> = {
  question: MODEL_QUESTIONS.viewCaption,
  keys: CAPTION_KEYS,

  recognise(record): CaptionTask | null {
    const { caption, key } = record;
    return typeof caption === "string" && typeof key === "string" ? { kind: "caption", caption, key } : null;
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const spelling of VIEW_TYPE_SPELLINGS) criteria[spelling] = spelling.toLowerCase().replace(/_/g, " ");
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      state: { caption: task.caption },
      questions: {
        view_type: {
          type: "choice",
          instructions:
            "`caption` is the text captioning one view on a structural construction drawing, which the deterministic caption grammar could not classify. Which class of view does this caption name? Choose UNTYPED if the caption names no class of view a reader could tell.",
          criteria,
        },
      },
    };
    return {
      body,
      read(answers) {
        return { payload: { type: choiceOf(answers["view_type"]) ?? null }, sources: [task.key] };
      },
    };
  },
};
