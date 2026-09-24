/**
 * AC-3 — J-001 and J-002 stay green honestly.
 *
 * The two journeys inc-010b landed are this increment's to own, which is exactly why they are worth
 * guarding: the cheapest way to make a journey exit 0 is to stop it asking. So this file compares
 * each spec against its pre-fix self and refuses a net loss — assertions, visual comparisons and
 * named checkpoints are a floor that may rise and may not fall — and it holds any regenerated
 * baseline to B-20's discipline: its own commit, subject starting `baseline:`, naming the proof.
 *
 * Whether the two journeys exit 0 is the journey lane's own reading, made by the gate against the
 * built product on one `--journey` invocation each; nothing here re-runs them.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRE_FIX,
  REPO_ROOT,
  blobAt,
  branchCommits,
  assertionCount,
  callCount,
  changedSincePreFix,
  commitsTouching,
  gitLines,
  literalArgumentsOf,
  objectIdAt,
  objectIdInTree,
  withoutComments,
} from "./support/history";

/** The two journeys this increment owns, by the spec paths the ownership list names. */
const OWNED_JOURNEYS = ["tests/e2e/journeys/j-001-auth.spec.ts", "tests/e2e/journeys/j-002-tenant-admin.spec.ts"] as const;

/** The journey ids those specs walk — what a `baseline:` subject has to name to name its proof. */
const OWNED_JOURNEY_IDS = ["J-001", "J-002"] as const;

/** The working-tree text of a repo-relative path, or null where the tree has not got it. */
function currentText(path: string): string | null {
  const absolute = join(REPO_ROOT, path);
  // white-box: AC-3 — the criterion is a property of the two journey SPECS' own text: that each
  // still makes at least as many assertions, declares at least as many cases and names every
  // screenshot and checkpoint it named at the pre-fix merge. What the journeys DO is the journey
  // lane's reading, made against the built product; "they have not been weakened to get there" can
  // only be read off the text, compared with the same text at `PRE_FIX`.
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/** Is this a baseline image belonging to one of the two journeys this increment owns? */
function isOwnedBaseline(path: string): boolean {
  return isBaselineImage(path) && (path.includes("j-001") || path.includes("j-002"));
}

/**
 * Is this a journey baseline image at all, whichever journey it grades? B-20 grants every
 * law-changing increment the ownership to re-baseline what its change froze, so a re-baseline is
 * read the way B-20 means it — any journey's image — and not "a baseline this increment happens to
 * own".
 */
function isBaselineImage(path: string): boolean {
  return path.startsWith("tests/e2e/") && /\.(?:png|jpg|jpeg)$/i.test(path);
}

/**
 * The frozen expectations a lane grades against, which B-20 re-baselines beside the pictures: it
 * says "the tests and visual baselines that assert them" — two kinds, and the first is not an
 * image. A regenerated comparison artifact (the cad lane's entity graphs) and a frozen expectation
 * a plan has DECLARED re-baselined both land under the same discipline, so the stray reading below
 * has to admit them; reading `baseline` as pictures alone makes a lawful `baseline:` commit a red
 * no actor may clear.
 */
function isRegeneratedBaseline(path: string): boolean {
  return isBaselineImage(path) || /^cad\/tests\/fixtures\/.*\.entitygraph\.json$/.test(path) || DECLARED_REBASELINED.includes(path);
}

/** The ask-route corpus's recordings the two `baseline:` commits of ASK-2 carried, by request hash (see below). */
const ASK_ROUTE_RECORDINGS: readonly string[] = [
  "0107703505cebbe40920ce49b40c9b12c112470cd36fbd172ebe79a1d630c6a6",
  "027eef21b1013c7ee617d199e7baa02261890660361f783b339e82d116e00627",
  "02e5b5c7c0b777987a62150428d7e3304042dab5fb4a776cb8d4d7560b15a392",
  "03273040ced24b61a9594b0a0534ec596a312d94aa4860e6e73a9433ca17b342",
  "063349da461cce1b01de82fd90ab80894dbaf5f2a2d25b0131f2cce333343a42",
  "07be4464d6bf16d1c5310965d8fa962c06e8008b6a56e5af45fc2c1a39da213b",
  "08e5c0a6b873f12ecf117514a3115c618de14f50c40b112328c67b13b928fae9",
  "09ce68e8a1257b1270ca4c3f6adcb95c7135eeeb454695afe7a5b007a27f6d2d",
  "0bc76cf35c8755695a35f1ef2e926f2cee545f53a12d80409a044f95ac86abaa",
  "0eec582dc30b64235bcdf06aab96086db4efba0a81a177a3da993992d3b2dc77",
  "0f4f68e62efc7937fe5dcb6e86030415d1765d2583ca5331266fb484cb5bc69d",
  "131c2a99864c0087458ccd9140f2e38a454fc6596c22a88500b697112d046303",
  "1a96678a3ca099952e169460931f386674c93a3bb71736114bc1cb57df7f22c0",
  "1dadb9b2568bc406c98a281b416b9af48af180174f0679e072773526f26a9c76",
  "1f5741b9c92f53a4d561df5da5fd504a4c35cade5226df425b9626868f515a50",
  "20516b77b9a96f43534d996ef16fc12be3dc95ef7127a729f6fd744a5a8121d6",
  "221fa2d7cebab65449c90658539d5d7d6c6538f0ef764cbb7926755fbf3cd2ee",
  "27076caf6d53b3c7b4b0f441c791db3003b365836611f6b60cbdd10a212edc93",
  "29b137cb8b2afd71371589235eaae26e85e4d76740ae143a222dd485c2261c77",
  "2bfe00575e572c47778ae6031097d6ed7dd66942c38c5ac6e5445d85ede1d77a",
  "31a47bd077d1668f8bb38623c2d7dc8a9b7af30d4e690239259272f8046a6c70",
  "3383c2863a027729cecbf92959de10a1cb30b0f55e8ff0605d8d93eb81ec16d7",
  "396cd9018368fc7aaebc2019cca3c3ffc14432596da910d07094226114060b10",
  "3ee75d6839b4b66daef9dc20f19a117fba4174ee4726db0cec4b2b3bbcc55f07",
  "4015e2d655ef2ecba7920c93fe0457f095bb6dda3ecae22157258772dd3b466b",
  "4073fdc99ff425a499755fd9ea236cb260290b0e51f396b718e3dba1e2f1324a",
  "43abc7d82e891803a583273f26f4fba0905de9bc289b746803c0e7380bc7c3c9",
  "4916252ec194064d3819efd2357b73b307556ed101f7e4970685ba2d7bab2027",
  "4acb8aea74548241d94c4dbb1fd5db8d4d7708b55c4cc29e0c073a530880ac03",
  "4b3a3ea8c977677c98f4c43edb3bc2cd6a4b333da0a542cc7d8faa829a232ab8",
  "4cc9046c2505ae46cba6c20b0aba4e18ee3c71e3dd87f5ab574a7c856930a278",
  "52a30439587abedb2876cb06d679cc910204ca007dc59ba05e80c7fcfbea94d8",
  "56eaee28396d2cf88b400a6f67d5c4f46b829b9b7888f183e225e5b13eb7a249",
  "5857e0d322fc6564210e578d43fbade99500f11b4719d15aa6955ad25afa5bd6",
  "5a508280eae83cbe992359fc0ef624ba43bed74e3305367c34f8160f0c93db3e",
  "5c4e7506d5b102ec4026bf2178c2d231c0a4fb4a0f4923cc0e9c521f8fe8a59d",
  "618aebe9e436ea5e93775a20e24e1f9dbb790e57953ffae9bab9d249ef37978d",
  "6248675266bfa0ee5182f6381504c18a016af0eda6299542b64b47ee36e26960",
  "66a0b9ac381de7901fca551221008bb121cfc4dd0b8b30e37cb4b283628fd434",
  "672be681673bd264260d65ddc2b4322a9804a53b0eb45641216ef95ed42968fd",
  "687539ebd397b1b4017fdfd1aeb39271b9dd1bad790d6285332675f380ed328c",
  "68cdfe7adfc1e1d8e92858aee1406bbcc87bbe50fba127b770a293f6b9e8ad64",
  "6999ba6197da6e86d54043a6a452fc476355f3f55af6f070c5a6c81e2fe80a46",
  "6ccebf395f5cc41bd20c41dfaf704182ad4146d80dc4a546690eedf36263cae2",
  "6e6af55a304da705ea6ebe5321cd1167bc62d258164004b28b8bf4986f5e3632",
  "76d0a0a6f439a68a732fd6968101195c7741f9bf60dc75b5975a6be8e2cfebb3",
  "795b71c07560b08c08495f83895c8920082886fccc9bb8a925655303331faf1a",
  "7c7b2faa87eac0386a5169be4a199e53205c6ff8b87791da8403ddc302ca6fb3",
  "7f11ae1f79c0dc51a881add97cb4395f8da1f508dd15b3839f7f612da220d7a0",
  "83b7ad233a920c9880b5fc331be5a9586670e9889bdd31ca2d9524885a24bb62",
  "84470097879c2c6cf4062dd092524d6d0baa08def6dfe0a43f77e36c58f8410b",
  "886431d9797a3119b26db094e5b08a738f9df6562e6d15446950ec143d3c369c",
  "8d6cd82b0fc04c0814cc9332af4ddd35152cff479291b7d5766cd3a1b6b467f8",
  "8e909de1756f4aece5777a71f43ecc99b3c696753cfc0e1f8f76556a167d6f46",
  "8e9ed46cb06607b11df7387a67eb28e7aeeface6d1cb82fb2a8f5cff2651ef04",
  "8ee13c2edb3e794919b6312cdb1a6374ace0e1a9d61e4108f65698d9c5f8dd38",
  "91c44795259a8995ced68604ea26f0721c30df012ff27f04031c53081c731b89",
  "931511b6006bb51fa9b950c9f4c934565cc5c0a4e60005d0f1cd8a66cac01612",
  "95119229ae6e5487625433bdcd4852313c4ef4a7fa6628c4f77807f2d2632e19",
  "9652a8cf6edd047b0942b3bcce9b6131131e061932fe1bf3648447c675af90a0",
  "96d6089fdba9aa6808393329ec555689cf39286d65d1b128a7414beda935b185",
  "97ecb17ca1e5ce86385ba73bce1dbdafd84a3948dc47125a98c2fb43a01a797a",
  "9839dd59ecd00740a03b285776048fb7ee10ad52a89a934d2f33fe927dd0074f",
  "9846904a910c097a36914fe9f06dd84af1e7aebae241c52495d8c88237dc589c",
  "986999b4d92a5cade5ec2493cb65a3aa1ab5410e6a80844b727c45a3c7b3af0e",
  "a13987ff9e182d66a54634b4825df50beb7c60fefd9da90a7d67113fef1032dd",
  "a49d6a7871921ce798369ac3393edba05c1077eb020248e0194fd77c67b0dadb",
  "ab9f61a7ef3ac2e9ae9b21223833e3dd9e9e87b4c30d91386ccc46c3655e574f",
  "ad2c18530381ad0b64ab2613b50fe267089b064834c2360f2401fedacde9b8d6",
  "af35b70893e4ea89c56cc13aff8503eecab73a6b8b14dd837440a06fa1b777e1",
  "b132944d9150282f3fab13c422347dff0278a18697251ddbe2aed2418dcd4b63",
  "b1e5ee1ac91786bb50f74af57f9fbf21c7f5f342746baa854a9dc61bdf7354b7",
  "b7849d845f549b7c41c56b80826dc1d059bf5477f2ea6aa20d6b9a2658b4ed45",
  "bb2774bb6c9f1f2987e4c2d1bd235f174723b30713966108950474bbf56f233a",
  "bc2ed6e135e11fb33e11cd286192fa47bc79f600dd4c483ebcba33558b1c0593",
  "bcfe088750f7f213e87de27e4ad5caed5602af5842b60976a18fc8012b97bca2",
  "c0f2e0ab465fbfacf808b6c320739059f9e4e7bc88384b9ba0b38dea17eb2872",
  "c40f0b0384c01183ee824c4619ae45d8bf43f631622f70c3ca2192ac049c5837",
  "c568c596ff772b36f2e316dfb0555e08de11f5463d382e577e68c0c8fd75b034",
  "cac5f7078aa3c47722df7edaa5defe11e994eee2925e182e4e79cac8242386a7",
  "cca8d3b6bbcb3f6f23f741ed670eced60b47807227dad8993102ee5451feaf5e",
  "ce83c2457a2c7d9addc8fd170c1b0910a0ceeb4c15ccb46bac78c1ad344a331c",
  "cfb9183f997578f0bcff709eef76a5f130c2cbb0526d81f3d07af4efb990ba31",
  "cfbfdfcc5731e2f89ea9ba8569e2d4ff5084ad42fb1214f7aac9368e025e9d02",
  "d08b2a5ab4d8a45817df2f749ef1b1261e48f0df27852177df18a2098faf342d",
  "d0af1f860d4517bbd45c667048390753de3479b3bb3eb099adc81322fe41457e",
  "d3bb5ebf13bde01a21e47aef92e9730c1684e62e8488274260973e58d686157b",
  "d4da09c0d47c1cc3668f9bc72d9320578b5fd381fbc6b0eb89105ce8e11c6834",
  "dcd5980f7b270567d8a41cbe8e1b3d8e45ef3cc1f1b2933ce7903d0767ad1fc8",
  "dea7e0064c2b019808d50b60e2b4f0d79beec69cb0c756228d3aca4f18fc2d68",
  "df47a18e1a743dfc0e37d07ffeaf341655dee03f4cebe2552b6b6fac73a5120e",
  "e22af4169a55a6465958aec28af1f280591728ccaebab5bc3ae75345f17cf33a",
  "e27bd7fe8a32dbce5f5b1afa0cbe83cdcfc4df4f1948ea78277ca043218da044",
  "e2b1ce644dd9d6cb88bafcd9ff375bb251d66481b40647ff2698b69bdc2510c6",
  "e5ae86ece0260441c24380105a0a601e43fbb47020e343e37acece32704793e8",
  "e78d3b5ae078fb78190b0dc7ec4c1c6fd82efb82e19450f0d4ed76f0c7bba01e",
  "e7ee88fc668296a5da5ea6b81f46c4e32646092b0907ed78e038184be73daf66",
  "f7de730f90cc3d573077bd433ee18f16375a4ff987e9d877138b918819cb467c",
  "f8c59ca52f346174f3a18ab93a343de44da163eca820f1480fb32490c5e3c6db",
  "fd6b7441d3b1f5a54e494e8eed2608b8600259fec7ddce2a8b2c161badfe91b3",
  "ff3c556cb809e75108c9d52369cf0420515169c468d80d9dab4c216fb7c0ffeb",
];

/**
 * The frozen expectations this branch's plan names as re-baselined — no wider a licence than the
 * criteria spell, so every undeclared file is still a stray.
 *
 * `src/core/errors/aggregate.test.ts` is the third: inc-301's AC-2 (iii) declares it re-baselined for
 * the three EXPORT_* entries and asks for it "in its own `baseline:` commit naming the three
 * entries", which is B-20's own discipline. The frozen expectation happens to live beside the
 * register it freezes rather than under `tests/`, and where a declared re-baseline lives is not what
 * makes it one.
 *
 * That third entry and this note are the ARBITRATION's, not a Builder's: the ruling on inc-301
 * (DECLARED_REBASELINED) ratifies them as an arbiter-ordered amendment, so no reviewer reads them as
 * scope drift. The same ruling's wider cure — scoping the stray reading to STATE, by reading the
 * declaration out of the increment specs on the branch and deleting this list — waits on a source a
 * test can read: no increment spec is committed to this tree (`docs/specs/` holds the Bible, the
 * perf specs and the design decisions, and nothing increment-shaped), so a read of it today would
 * admit nothing and turn a lawful `baseline:` commit into a red no actor may clear. Until a spec
 * lands in the tree, the ruling's second limb governs and the list stands.
 *
 * `tests/jobs/support/hotfix-baseline/jobs-seam.main.txt` is the fourth: main's jobs-seam suite
 * frozen at FORK_POINT da94c0d3 for inc-hotfix-20260914-0052's AC-3, re-taken past the SEAM-JOBS
 * AC-2 arbitration (437041d8). The pre-ruling copy demanded of `tests/jobs/jobs-seam.test.ts` a
 * measured gap compared against another measured gap — a wall-clock budget AM-10 §3 forbids a gate
 * lane to assert — so keeping the frozen copy would oblige the lane to keep an assertion the
 * arbitration struck out, which is exactly the frozen expectation B-20 lets an increment re-take.
 * It rode its own commit, `baseline: the frozen jobs-seam copy is re-taken past the arbitration
 * (B-20, SEAM-JOBS AC-2)`, which names its proof; the stray reading below is what would otherwise
 * make that lawful commit a red no actor may clear. This entry, like the third, is the
 * ARBITRATION's and not a Builder's, so no reviewer reads it as scope drift.
 *
 * The fifth, sixth, seventh and eighth are inc-306-rails-frame's, and they too are the ARBITRATION's
 * and not a Builder's — ordered in the manner of the third and fourth, so no reviewer reads them as
 * scope drift. AC-1 of that increment declares its re-emissions by path: "`db/catalogue/work-items.json`,
 * `bears.json` and `digest.txt` are re-emitted from the consts (catalogue-drift green, a `baseline:`
 * commit)" — the shipped emitter writes all three from the consts and catalogue-drift grades them, so
 * a kind landing in `KINDS` moves them mechanically. The same criterion declares "`KINDS_BEFORE` in
 * src/modules/takeoff/rails/aggregate.test.ts re-baselined to that pair" (`["rcc.concrete",
 * "rcc.formwork"]`), which is the frozen roster that increment's split proof compares the enumerated
 * whole against. `src/core/errors/aggregate.test.ts` stays its own named entry above — inc-301's three
 * EXPORT_* codes, and AC-4's three frame codes — and is not folded into any pattern; a roster that
 * moves mechanically takes a NAMED entry backed by a quoted criterion, never a class-wide rule, since
 * a pattern over every file called `aggregate.test.ts` would admit an arbitrary edit to any roster for
 * all time and defeat the checkpoint below. The licence widens by exactly these declared paths and not
 * in kind: every undeclared file is still a stray.
 *
 * The ninth is inc-300a-doc-seam's, declared by its AC-2 in the same manner as the third and fourth:
 * the golden PDF is "byte-identical to the committed golden tests/docs/proof/golden.pdf (sha256
 * compared, the golden byte-frozen and committed in its own `baseline:` commit naming this proof)".
 * A golden PDF is a frozen expectation a lane grades against — the same kind of thing as the cad
 * lane's entity graphs, and not an image — so B-20's discipline is exactly what it lands under, and
 * without a named entry the very commit that criterion demands is the red no actor may clear that
 * this reading exists to avoid. Its own commit names the proof (`baseline: the proof document's
 * golden PDF, minted by the pinned renderer`). One path, backed by a quoted criterion, as the note
 * above requires: that literal path alone, no pattern over `tests/docs/**` and none over `*.pdf`, the
 * fifth-to-eighth note's bar on class-wide rules governing here too — the licence does not widen in
 * kind, and `tests/docs/**` at large is still stray. This entry and this note are the ARBITRATION's
 * and not a Builder's — the ruling on inc-300a's AC-2 (TEST_AMENDED) orders the entry kept, quoting
 * "the golden byte-frozen and committed in its own `baseline:` commit naming this proof", and ratifies
 * as lawful the commit that added it, b30e9530 — so no reviewer reads either as scope drift.
 *
 * The tenth is inc-304b-site-facts-panel's `tests/ui/project-settings/support/hotfix-304a-fork-point.ts`,
 * and it too is the ARBITRATION's and not a Builder's — ordered in the manner of the third and fourth,
 * so no reviewer reads it as scope drift. It is a frozen-bytes expectation, the kind B-20 re-baselines
 * beside the pictures, and its own docblock — a locked instrument on this branch — orders the re-take by
 * name: "A later increment that lawfully re-takes any picture or amends any Decision below owns this
 * manifest with it (B-20): the line is re-taken in the same `baseline:` commit as the picture." The
 * re-take is compelled, not elective: AC-4 adds the checkpoint `s-settings-site-facts/panel-absent` and
 * checkpoint.ts fails any checkpoint the budget does not name, so the frozen `tests/e2e/support/axe-budget.ts`
 * had to move, and AC-5 names the sub-nav Decision re-baselined because I-259's disabled span for
 * site-facts became a link. It rode its own commit, 593e07cc, `baseline: the fork-point manifest catches
 * up with the sub-nav Decision and the axe budget (inc-304b-site-facts-panel)`, which names its proof;
 * the stray reading below is what would otherwise make that compelled commit a red no actor may clear.
 * One literal path, as the fifth-to-eighth note requires — no pattern over `tests/ui/**` and none over
 * `*-fork-point.ts`: the licence widens by this declared path and not in kind.
 *
 * The eight F-RCC6-BNBC paths are the ninth: the corpus is generated by its committed script
 * (AM-01) and the product's law puts a regenerated fixture in its own `baseline:` commit naming
 * the proof (CLAUDE.md, "Fixtures and the golden"). W-18 (`fixtures/gen/rcc6_bnbc/DECISIONS.md`,
 * `docs/handoff/fable-5.1-session-2.md`) kept every paper layout's own viewport, which moved the
 * two DXFs, the two DWGs (judged by census), the LibreDWG twin, the manifest hashes and one line
 * number in the two trap registries, and nothing authored. Eight literal paths, no pattern over
 * `fixtures/rcc6-bnbc/**`: the goldens, cells, PDFs and rasters stay strays if a baseline commit
 * ever carries them without a declaration of their own.
 *
 * The R0 paths are that declaration, and R0-BASE's (session 8). The owner ruled R0 "Regenerate and
 * draw all": the F-RCC6-BNBC golden moves to follow its drawing and its law, and the drawing is
 * corrected and completed, so the whole corpus re-mints once — the goldens, the cells, the model,
 * the site facts, the notation corpus, the sanity counts, the three PDFs and the 24 rasters, beside
 * the eight paths above. The R0 design (§9) names the test data that pins the corpus's content and
 * must move atomically with it: the notation allowance and its tally
 * (`tests/takeoff/notation/corpus-allow.json`, `corpus.test.ts`), the S-01 note-clause count
 * (`tests/takeoff/notes/clauses.test.ts`) and the BBS render's payload and golden PDF
 * (`tests/docs/bbs/`), whose rows lead with the pile caps the cap-cover correction moves. Its
 * criterion: the corpus "regenerates byte-identical" from the committed generator and the revision
 * register holds (check 9, `cad/tests/rcc6_bnbc/test_rcc6_bnbc_revision.py`) — the proof a
 * `baseline:` subject names. One literal path per file, as the fifth-to-eighth note requires: no
 * pattern over `fixtures/rcc6-bnbc/**`, `raster/**` or `tests/**`; the images, the xref target and
 * every undeclared file are still strays.
 */
const DECLARED_REBASELINED: readonly string[] = [
  // Retired on 2026-09-21 with the hotfix that wrote it (the J-000 byte-freeze); its two re-takes
  // on this branch stand in history, so the path stays declared for the baseline commits that carry it.
  "tests/ui/project-settings/support/hotfix-304a-fork-point.ts",
  "fixtures/gen/rcc6_bnbc/traps.json",
  "fixtures/rcc6-bnbc/manifest.json",
  "fixtures/rcc6-bnbc/rcc6-bnbc.dwg",
  "fixtures/rcc6-bnbc/rcc6-bnbc.dxf",
  "fixtures/rcc6-bnbc/rcc6-bnbc.libredwg-r2000.dxf",
  "fixtures/rcc6-bnbc/rcc6-bnbc.model.dwg",
  "fixtures/rcc6-bnbc/rcc6-bnbc.model.dxf",
  "fixtures/rcc6-bnbc/traps.json",
  // R0-BASE (session 8): the rest of the F-RCC6-BNBC corpus and the test data that pins its content.
  "fixtures/rcc6-bnbc/takeoff.golden.json",
  "fixtures/rcc6-bnbc/bbs.golden.json",
  "fixtures/rcc6-bnbc/cells.json",
  "fixtures/rcc6-bnbc/model.json",
  "fixtures/rcc6-bnbc/site.json",
  "fixtures/rcc6-bnbc/notation.corpus.json",
  "fixtures/rcc6-bnbc/sanity.json",
  "fixtures/rcc6-bnbc/rcc6-bnbc.pdf",
  "fixtures/rcc6-bnbc/rcc6-bnbc.shx.pdf",
  "fixtures/rcc6-bnbc/rcc6-bnbc.r2.pdf",
  "fixtures/rcc6-bnbc/raster/r1/s-01.png",
  "fixtures/rcc6-bnbc/raster/r1/s-10.png",
  "fixtures/rcc6-bnbc/raster/r1/s-11.png",
  "fixtures/rcc6-bnbc/raster/r1/s-17.png",
  "fixtures/rcc6-bnbc/raster/r1/s-20.png",
  "fixtures/rcc6-bnbc/raster/r1/s-26.png",
  "fixtures/rcc6-bnbc/raster/r2/s-01.jpg",
  "fixtures/rcc6-bnbc/raster/r2/s-10.jpg",
  "fixtures/rcc6-bnbc/raster/r2/s-11.jpg",
  "fixtures/rcc6-bnbc/raster/r2/s-17.jpg",
  "fixtures/rcc6-bnbc/raster/r2/s-20.jpg",
  "fixtures/rcc6-bnbc/raster/r2/s-26.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-01.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-10.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-11.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-17.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-20.jpg",
  "fixtures/rcc6-bnbc/raster/r3/s-26.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-01.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-10.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-11.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-17.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-20.jpg",
  "fixtures/rcc6-bnbc/raster/r4/s-26.jpg",
  "tests/takeoff/notation/corpus-allow.json",
  "tests/takeoff/notation/corpus.test.ts",
  "tests/takeoff/notes/clauses.test.ts",
  "tests/docs/bbs/payload.json",
  "tests/docs/bbs/golden.pdf",
  "tests/rulesets/support/editions.ts",
  "db/__tests__/ruleset-editions.migration.test.ts",
  "src/core/errors/aggregate.test.ts",
  "tests/jobs/support/hotfix-baseline/jobs-seam.main.txt",
  "db/catalogue/work-items.json",
  "db/catalogue/bears.json",
  "db/catalogue/digest.txt",
  "src/modules/takeoff/rails/aggregate.test.ts",
  "tests/docs/proof/golden.pdf",
  // A-REGISTER-JSON's published schema: its own test (register-json-schema.test.ts, AC-2) re-baselines
  // it "in its own `baseline:`-subject commit" when the live Zod schema's JSON form moves — as zod 4.6
  // moved it (db0927e9, D-004).
  "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.schema.json",
  // And the committed reading the export is a function of, with the whole document written from it
  // (register-json.test.ts, AC-1): when the reading's shape grows — 1.1's `raster` and `agreedBy`
  // (s-takeoff I-686) — the reading, its example and the schema are re-baselined together.
  "src/modules/takeoff/export/register-json/__tests__/fixtures/register-view.sample.json",
  "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.example.json",
  // F-ARCH (session 8, ARCH-1): the corpus `python -m fixtures.gen.arch` writes, every file of it —
  // minted and re-minted in its own `baseline:` commits naming the proof, as the product's law puts a
  // regenerated fixture (cad/tests/sanity/test_arch_regenerate.py holds it byte for byte). Eight
  // literal paths, no pattern over `fixtures/arch/**`: a file the generator does not write stays a stray.
  "fixtures/arch/arch.dxf",
  "fixtures/arch/cells.json",
  "fixtures/arch/manifest.json",
  "fixtures/arch/model.json",
  "fixtures/arch/notation.corpus.json",
  "fixtures/arch/sanity.json",
  "fixtures/arch/takeoff.golden.json",
  "fixtures/arch/traps.json",
  // V-DOCS (session 8): the draft BOQ's and the bar schedule's document goldens — the payload the seam
  // emits and the PDF the pinned renderer makes of it, re-taken in their own `baseline:` commits naming
  // `pnpm test:docs` (which renders each byte-identical twice and to its golden), as the proof
  // document's golden above already is. A lawful change to a document moves them; nothing else may.
  "tests/docs/boq-draft/golden.pdf",
  "tests/docs/boq-draft/payload.json",
  "tests/docs/bbs/golden.pdf",
  "tests/docs/bbs/payload.json",
  // S-Ask's read-back (session 8, ASK-1a; docs/design/s-ask.md I-493): one F-RCC6-BNBC J-000
  // project's newest campaign, taken READ ONLY off cubit_e2e, that the ask engine's unit tests read
  // every figure off. It was minted in its own `baseline:` commit together with the one statement that
  // takes it, so the document and what reproduces it were reviewed as one; a re-take when M3's register
  // moves (FRM-3, FRM-4, R0) moves the document, in a `baseline:` commit naming the tests it feeds.
  "tests/ai/ask/fixtures/bnbc-readback.json",
  "tests/ai/ask/fixtures/bnbc-readback.sql",
  // ASK-2's ask-route corpus (session 9): two commits, 34a10f7a and 4abd17d1, recorded it under a
  // `baseline:` subject where the recorded corpora before them were filed as `baseline(corpus):` —
  // a subject this reading does not take up. Landed commits are not rewritten, so what they carry is
  // declared by path. The recordings are what `scripts/model-corpus.ts` writes, each filed under its
  // request's hash and never hand-authored, and `corpus.json` is the roster it re-derives beside them.
  // `tests/ai/ask/paraphrases.json` is the corpus's source: its stage keys are read back off
  // cubit_e2e and each paraphrase's intent is the expectation route-corpus.test.ts grades, and a
  // recording is keyed on the request its paraphrase composes, so the two cannot land apart without a
  // red commit between them — the precedent of `bnbc-readback.sql` above, the statement minted with
  // the document it takes. Literal paths, as the notes above require: no pattern over
  // `fixtures/model/**`. A later recording lands under `baseline(corpus):`, as the first ten did.
  "fixtures/model/corpus.json",
  "tests/ai/ask/paraphrases.json",
  ...ASK_ROUTE_RECORDINGS.map((hash) => `fixtures/model/${hash}.json`),
];

describe("AC-3: J-001 and J-002 keep asking what they asked, and any re-baseline says so", () => {
  for (const path of OWNED_JOURNEYS) {
    it(`AC-3: ${basename(path)} asks at least as much as it did at the pre-fix merge`, () => {
      const before = blobAt(PRE_FIX, path);
      expect(before, `${path} is not tracked at ${PRE_FIX}, so there is no pre-fix reading to compare against`).not.toBeNull();
      const after = currentText(path);
      expect(after, `${path} has been deleted; AC-3 keeps both journeys walking`).not.toBeNull();

      const old = before ?? "";
      const now = after ?? "";

      // Floors, not counts (B-19): a repair may lawfully add a case, a checkpoint or a comparison.
      // What it may not do is arrive at green by asking less than the pre-fix spec asked.
      expect(assertionCount(now), `${path} makes fewer assertions than it did at ${PRE_FIX} — AC-3 deletes and weakens nothing`).toBeGreaterThanOrEqual(
        assertionCount(old),
      );
      expect(callCount(now, "test"), `${path} declares fewer cases than it did at ${PRE_FIX}`).toBeGreaterThanOrEqual(callCount(old, "test"));

      // Every visual comparison the pre-fix spec made is still made, by name. Re-baselining changes
      // the IMAGE; dropping the `toHaveScreenshot` call changes what is graded.
      const shotsAfter = new Set(literalArgumentsOf(now, "toHaveScreenshot"));
      const droppedShots = literalArgumentsOf(old, "toHaveScreenshot").filter((name) => !shotsAfter.has(name));
      expect(droppedShots, `${path} no longer compares these baselines it compared at ${PRE_FIX}: ${droppedShots.join(", ")}`).toEqual([]);

      // The same reading for the named checkpoints V-E2E owes a screenshot at.
      const checksAfter = new Set(literalArgumentsOf(now, "checkpoint"));
      const droppedChecks = literalArgumentsOf(old, "checkpoint").filter((name) => !checksAfter.has(name));
      expect(droppedChecks, `${path} no longer stands on these checkpoints: ${droppedChecks.join(", ")}`).toEqual([]);

      // Silencing is the other way to stop asking.
      const bare = withoutComments(now);
      expect(/\b(?:test|it|describe)\s*\.\s*(?:skip|fixme|todo)\b/.test(bare), `${path} skips a case rather than answering it`).toBe(false);
      expect(/\btest\s*\.\s*setTimeout\s*\(\s*0\s*\)/.test(bare), `${path} disarms its own timeout`).toBe(false);
    });
  }

  it("AC-3: every regenerated baseline of these journeys landed in its own `baseline:` commit naming the proof", () => {
    for (const image of changedSincePreFix().filter(isOwnedBaseline)) {
      // An image the working tree holds differently from HEAD has not landed anywhere yet: B-20 asks
      // for a commit, and a commit is what the discipline is read out of.
      expect(
        objectIdInTree(image),
        `${image} differs from the pre-fix baseline but is not committed — B-20 wants it in its own commit whose subject starts \`baseline:\``,
      ).toBe(objectIdAt("HEAD", image));

      const subjects = commitsTouching(image);
      expect(subjects.length, `${image} changed since ${PRE_FIX} but no commit on this branch names it`).toBeGreaterThan(0);

      for (const subject of subjects) {
        expect(subject.startsWith("baseline:"), `the commit that moved ${image} is titled "${subject}" — B-20 wants a subject starting \`baseline:\``).toBe(true);
        const namesProof = OWNED_JOURNEY_IDS.some((id) => subject.includes(id)) || subject.includes(basename(image).replace(/\.[^.]+$/, ""));
        expect(namesProof, `"${subject}" re-baselines ${image} without naming the proof it stands on (its journey id or the baseline's own name)`).toBe(true);
      }
    }
  });

  it("AC-3: a `baseline:` commit carries baselines and nothing else", () => {
    // B-20's discipline is "its own commit". A repair smuggled into a re-baseline is a repair that
    // was reviewed as a picture. The stray reading is journey-agnostic on purpose: a later
    // increment's lawful re-baseline of a journey this increment never owned is still a `baseline:`
    // commit carrying only baselines, and reading it as all-strays would be a red no actor can clear.
    for (const { sha, subject } of branchCommits()) {
      if (!subject.startsWith("baseline:")) continue;
      const strays = gitLines("show", "--name-only", "--format=", sha).filter((path) => !isRegeneratedBaseline(path));
      expect(strays, `the baseline commit "${subject}" also carries files that are not baselines:\n  ${strays.join("\n  ")}`).toEqual([]);
    }
  });
});
