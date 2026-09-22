// What a corpus recorder is (Q-08, L-AI-01, AM-11). One closed question, one file: the subjects it
// puts to the provider, in the order it asks them, composed by the product's own request builder and
// by nothing this script spells. `./registry` enumerates them, and a question added to the product
// is one new file beside this one plus one line there.
//
// A recorder reads its own flags off the command line through the context it is handed, so a
// question that needs a drawing, a set or a limit asks for it in its own file and the script that
// enumerates them never learns what any of them means.
import type { ModelRequest } from "../../src/core/model";

/** The command line and the recorder's voice, as the script hands them in (B-23). */
export type RecorderContext = {
  /** The value given after `name` on the command line, or undefined where it was not given. */
  option(name: string): string | undefined;
  /** What the recorder cannot go on without: printed, and the process exits non-zero. */
  fail(message: string): never;
  /** One line to the person running the recording. */
  say(line: string): void;
  /** `fixtures/model` — where the committed corpus and its own artifacts live. */
  corpusRoot: string;
};

/** One question to record, and the words a reader files it under. */
export type Asked = {
  /** What a person reading the roster sees this recording was asked about. */
  subject: string;
  request: ModelRequest;
  /** The file the subjects were read out of, where the recorder read one. */
  artifact?: string;
};

/** One question's recorder: every subject it would ask, before a single one is posted. */
export type CorpusRecorder = (ctx: RecorderContext) => Promise<Asked[]> | Asked[];
