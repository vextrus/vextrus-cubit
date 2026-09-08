// R-TO-030's model door for a silent view caption (ARCH-02): the question, the model it is put to,
// and the reading of what comes back. A caller — the takeoff seam's stored partition, the worker's
// composition root, a later screen — speaks to view-caption classification through this file.
//
// The question itself is core's (`@/core/view-captions`), for the reason R-TO-004's sheets are: the
// module that asks it and the module that publishes it are different modules, and ARCH-01 lets
// neither name the other. This door is the name R-AI's readers know it by, and the two are one
// implementation rather than two spellings of one (B-17).
//
// The order is L-AI-03's own: "a deterministic grammar where the text is vector", so
// `src/modules/takeoff/partition/views/grammar.ts` answers first and no model is asked at all where
// it read anything. Only a caption the grammar is silent on reaches `claude-sonnet-5` (AS-05),
// through the model seam's own `propose`, which is the tree's only path to a model (L-AI-01).
export {
  VIEW_CAPTION_MODEL,
  proposeViewType,
  readViewTypeProposal,
  viewCaptionRequest,
  type ViewCaptionPort,
  type ViewCaptionQuestion,
  type ViewTypeProposal,
} from "@/core/view-captions";
