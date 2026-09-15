/**
 * The document seam as the acceptance addresses it: one typed view per module the increment's
 * interfaces name, each reached through `productModule` so an absent file fails the case that
 * needed it (SEAM-DOC, R-SPINE-040).
 *
 * The types here are the SPEC's, not the product's: a suite that imported the product's own types
 * would agree with whatever the product happened to declare. These say what the interfaces say, so
 * a surface that drifts from them fails to compile against the acceptance.
 */
import { productModule } from "./product";

/** What a render answers (R-SPINE-040, L-FMT-03). */
export type RenderedDocument = {
  kind: string;
  pdf: Uint8Array;
  sha256: string;
  payloadDigest: string;
  rendererPin: string;
  fontHashes: Readonly<Record<string, string>>;
};

/** Where a render is staged: the directory Typst is rooted at, its main file and its output. */
export type StagedRender = { dir: string; main: string; out: string };

/** Who asked for the document — what a fault is recorded against (ARCH-03). */
export type RenderCtx = { requestId: string; actor: string };

/** One embedded face: its file, the hash it is pinned by, its licence and its own repertoire. */
export type EmbeddedFont = { file: string; sha256: string; licence: string; covers(codePoint: number): boolean };

/** What a test injects in place of the subprocess and the faces (production takes the defaults). */
export type RenderDeps = {
  compile?: (staged: StagedRender, opts?: { binary?: string }) => Promise<Uint8Array>;
  fonts?: () => Promise<readonly EmbeddedFont[]>;
};

/** A document kind: its key, the schema its payload is parsed by, its template and its presenter. */
export type DocumentKind = {
  readonly kind: string;
  readonly payloadSchema: { safeParse(value: unknown): { success: boolean } };
  readonly template: string;
  present(payload: unknown): Record<string, unknown>;
};

export type DocumentsIndex = {
  renderDocument(kind: string, payload: unknown, ctx: RenderCtx, deps?: RenderDeps): Promise<RenderedDocument>;
};

export type TypstModule = {
  TYPST_ARGS: readonly string[];
  rendererPin(): string;
  compileTypst(staged: StagedRender, opts?: { binary?: string }): Promise<Uint8Array>;
};

export type FontsModule = {
  DOCUMENT_FONT_FILES: readonly string[];
  DOCUMENT_FONT_LICENCES: Readonly<Record<string, string>>;
  documentFonts(): Promise<readonly EmbeddedFont[]>;
  assertCoveredByDocumentFonts(text: string, fonts: readonly EmbeddedFont[]): void;
};

export type KindsModule = { DOCUMENT_KINDS: Readonly<Record<string, DocumentKind>> };

export type ProofModule = { PROOF_KIND: DocumentKind; PROOF_UNITS: readonly string[]; PROOF_QUANTITY_PRECISION: number };

export type FiguresModule = { figure(value: string, precision: number): string };

/** The seam's modules, by the paths the increment's interfaces give them. */
export const documentsIndex = (): Promise<DocumentsIndex> => productModule<DocumentsIndex>("src/core/documents/index.ts");
export const typstModule = (): Promise<TypstModule> => productModule<TypstModule>("src/core/documents/typst.ts");
export const fontsModule = (): Promise<FontsModule> => productModule<FontsModule>("src/core/documents/fonts.ts");
export const kindsModule = (): Promise<KindsModule> => productModule<KindsModule>("src/core/documents/kinds/index.ts");
export const proofModule = (): Promise<ProofModule> => productModule<ProofModule>("src/core/documents/kinds/proof.ts");
export const figuresModule = (): Promise<FiguresModule> => productModule<FiguresModule>("src/core/documents/figures.ts");
