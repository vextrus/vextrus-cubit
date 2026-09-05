/**
 * AC-2 — PIN_DRAWING_SET through the one act seam (L-ACT-01, L-ACT-02, L-ACT-03, L-REG-06, R-TO-005).
 *
 * The act is driven through the shipped seam and never around it: `preview` answers a Consequence,
 * its digest is carried back to `commit`, and what the store then holds is read as this file's own
 * audit read. Every subject and every citation expected below is derived from the lineages the
 * module itself answered for the staged project, so a project that grows a drawing grows the
 * expectation with it (B-19).
 *
 * The manifest's address is judged as an ADDRESS: the same members in any order have one digest,
 * and any change of member, revision or content gives another. Nothing here transcribes a digest.
 *
 * Staged lazily and memoised: a throwing hook leaves every case skipped, and a skipped case judges
 * no criterion at all.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  PIN_DRAWING_SET,
  PIN_SET,
  PRINCIPAL,
  actorOf,
  actsOfType,
  actsSeam,
  byCodePoint,
  closeStage,
  coreSetsSeam,
  grantRole,
  openSheetsStage,
  pinning,
  setRevisionRows,
  setsSeam,
  sha256OfText,
  stageLineage,
  stagePerson,
  unique,
  type ConsequenceLike,
  type CoreSetsSeam,
  type DrawingLineage,
  type DrawingSetView,
  type ManifestMember,
  type Person,
  type SetActsSeam,
  type SetsSeam,
} from "./support/sets-stage";

const BUDGET_MS = 300_000;

interface Staged {
  sets: SetsSeam;
  core: CoreSetsSeam;
  acts: SetActsSeam;
  person: Person;
  projectId: string;
  scope: { tenantId: string; projectId: string };
  setId: string;
  members: DrawingLineage[];
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const sets = await setsSeam();
    const core = await coreSetsSeam();
    const acts = await actsSeam();

    await openSheetsStage();
    const { person, projectId } = await stagePerson("pin");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const scope = { tenantId: person.tenantId, projectId };

    // Two drawings in the set and one outside it, so "one subject per member" is a claim the third
    // lineage can falsify; the first of them has been re-uploaded, so a pin has a current revision
    // to choose between and cannot pass by citing whatever row it met first.
    const inSet = [unique("pin-a.dxf"), unique("pin-b.dxf")];
    await stageLineage(person, projectId, inSet[0] as string, ["pin-a-1", "pin-a-2"]);
    await stageLineage(person, projectId, inSet[1] as string, ["pin-b-1"]);
    await stageLineage(person, projectId, unique("pin-outside.dxf"), ["pin-outside-1"]);

    const lineages = await sets.drawingLineagesOf(scope);
    const members = lineages.filter((lineage) => inSet.includes(lineage.name));
    expect(members.length, "the two lineages this set names stand in the module's answer").toBe(2);

    const created = await sets.createSet(scope, { userId: person.userId }, unique("Tender set"));
    expect(created.created, `the set was created: ${JSON.stringify(created)}`).toBe(true);
    const setId = (created as { created: true; setId: string }).setId;
    for (const member of members) {
      const toggled = await sets.toggleMember(scope, setId, member.drawingId);
      expect(toggled.toggled, `${member.name} was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);
      expect((toggled as { toggled: true; member: boolean }).member, `${member.name} is now a member`).toBe(true);
    }

    return { sets, core, acts, person, projectId, scope, setId, members };
  })());
}

/** The one pin this file commits, run once and read by every case that judges what it wrote. */
let pinning_: Promise<{ consequence: ConsequenceLike; carried: string; actId: string; view: DrawingSetView }> | undefined;

function pinned(): Promise<{ consequence: ConsequenceLike; carried: string; actId: string; view: DrawingSetView }> {
  return (pinning_ ??= (async () => {
    const stage = await staged();
    const consequence = await stage.acts.preview(actorOf(stage.person), pinning(stage.projectId, stage.setId));
    const carried = stage.acts.consequenceDigest(consequence);
    const written = await stage.acts.commit(actorOf(stage.person), pinning(stage.projectId, stage.setId), carried);
    const view = await stage.sets.setOf(stage.scope, stage.setId);
    expect(view, "the set the pin was for is still answered after it was pinned").not.toBeNull();
    return { consequence, carried, actId: written.actId, view: view as DrawingSetView };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** A manifest member with one field replaced — how "any change gives another address" is asked. */
function withField(member: ManifestMember, field: keyof ManifestMember, value: string): ManifestMember {
  return { ...member, [field]: value };
}

describe("AC-2: PIN_DRAWING_SET through the act seam", () => {
  test("AC-2: the act type joins the closed enum and moves PIN_SET", async () => {
    const stage = await staged();
    expect(stage.acts.ACT_TYPES, "PIN_DRAWING_SET is the act this increment renders (L-ACT-02's map is total over the enum)").toContain(PIN_DRAWING_SET);
    expect(stage.acts.ACT_PERMISSION[PIN_DRAWING_SET], "pinning a drawing set is what PIN_SET cuts on (L-ACT-03, verbatim)").toBe(PIN_SET);
  }, BUDGET_MS);

  test("AC-2: preview answers a SUBJECTS Consequence with one subject per member, keyed on the set alone", async () => {
    const stage = await staged();
    const { consequence } = await pinned();

    expect(consequence.rendering, "the Consequence renders through the shipped SUBJECTS arm (L-ACT-02)").toBe("SUBJECTS");
    expect(consequence.actType, "the Consequence names the act it was computed for").toBe(PIN_DRAWING_SET);
    expect(consequence.projectId, "and the project it was computed on").toBe(stage.projectId);
    expect(
      byCodePoint(consequence.subjects.map((subject) => subject.subjectId)),
      "one subject per member of the set, named by the drawing's own surrogate id — membership is resolved server-side from the set key (L-ACT-02: offered, never assembled)",
    ).toEqual(byCodePoint(stage.members.map((member) => member.drawingId)));

    for (const member of stage.members) {
      const subject = consequence.subjects.find((candidate) => candidate.subjectId === member.drawingId);
      expect(subject, `${member.name} stands as a subject of the pin`).toBeDefined();
      expect(subject?.subjectLabel, "a subject is labelled with the drawing's presented name").toBe(member.name);
      expect(subject?.before, "nothing was pinned before this first pin, so the member is cited by nothing").toEqual([]);
      expect(subject?.after, "and would be cited at the content it stands at now").toEqual([member.current.sha256]);
    }
  }, BUDGET_MS);

  test("AC-2: the commit writes exactly one act and exactly one immutable set revision", async () => {
    const stage = await staged();
    const { actId, view } = await pinned();

    const acts = actsOfType(stage.person.tenantId, stage.projectId, PIN_DRAWING_SET);
    expect(acts.map((act) => act.actId), "the pin wrote exactly one act row of its own type (L-ACT-01: one act, one record)").toEqual([actId]);
    expect(setRevisionRows(stage.person.tenantId, stage.setId).length, "and exactly one set revision beside it").toBe(1);

    expect(view.revisions.length, "the set answers the one revision it stands pinned at").toBe(1);
    const revision = view.revisions[0] as DrawingSetView["revisions"][number];
    expect(revision.current, "the newest pinned revision is the current one").toBe(true);
    expect(revision.actId, "the set revision names the act that authored it (L-ACT-01: the state change and the act row are one write)").toBe(actId);

    expect(
      byCodePoint(revision.manifest.map((member) => member.drawingId)),
      "the manifest is the citation list: every member the set held is cited (L-REG-06)",
    ).toEqual(byCodePoint(stage.members.map((member) => member.drawingId)));
    for (const member of stage.members) {
      const cited = revision.manifest.find((candidate) => candidate.drawingId === member.drawingId);
      expect(cited, `${member.name} is cited by the manifest`).toBeDefined();
      expect(cited?.revisionId, "a citation names the revision the member stood at when it was pinned").toBe(member.current.revisionId);
      expect(cited?.sha256, "and the content that revision is").toBe(member.current.sha256);
      expect(cited?.name, "and the presented name it was pinned under").toBe(member.name);
    }

    expect(revision.digest, "the digest is a lowercase 64-hex sha256").toMatch(/^[0-9a-f]{64}$/);
    expect(revision.digest, "and it is the address of this very manifest — content-addressed means the content decides the address (L-REG-06)").toBe(stage.core.manifestDigest(revision.manifest));

    const summaries = await stage.sets.setsOf(stage.scope);
    const summary = summaries.find((candidate) => candidate.setId === stage.setId);
    expect(summary, "the set stands on the index of its project").toBeDefined();
    expect(summary?.currentDigest, "and the index carries the digest it stands pinned at").toBe(revision.digest);
    expect(summary?.memberCount, "with the number of drawings it names").toBe(stage.members.length);
    expect(summary?.revisionCount, "and the number of revisions it has been pinned at").toBe(1);
  }, BUDGET_MS);

  test("AC-2: the manifest digest is an address of the members, not of their order", async () => {
    const stage = await staged();
    const { view } = await pinned();
    const manifest = [...(view.revisions[0] as DrawingSetView["revisions"][number]).manifest];
    expect(manifest.length, "there are two members to shuffle").toBeGreaterThan(1);

    const reversed = [...manifest].reverse();
    expect(stage.core.manifestDigest(reversed), "an unordered set of pairs has ONE address however the members are handed over (L-REG-06)").toBe(stage.core.manifestDigest(manifest));
    expect(stage.core.canonicalManifest(reversed), "which is true because the canonical form is sorted before it is addressed").toBe(stage.core.canonicalManifest(manifest));

    const first = manifest[0] as ManifestMember;
    const rerevved = [withField(first, "revisionId", (manifest[1] as ManifestMember).revisionId), ...manifest.slice(1)];
    expect(stage.core.manifestDigest(rerevved), "re-revving a member yields another set revision, so it must yield another address (L-REG-06: advance, never drift)").not.toBe(stage.core.manifestDigest(manifest));
    const recontented = [withField(first, "sha256", sha256OfText(`${first.sha256}-moved`)), ...manifest.slice(1)];
    expect(stage.core.manifestDigest(recontented), "the address is a CONTENT address: the cited sha256 is part of what it addresses (I-E)").not.toBe(stage.core.manifestDigest(manifest));
    expect(stage.core.manifestDigest(manifest.slice(1)), "removing a member yields another set revision").not.toBe(stage.core.manifestDigest(manifest));
    const added = withField(first, "drawingId", `${first.drawingId.slice(0, -1)}${first.drawingId.endsWith("0") ? "1" : "0"}`);
    expect(stage.core.manifestDigest([...manifest, added]), "adding a member yields another set revision").not.toBe(stage.core.manifestDigest(manifest));
  }, BUDGET_MS);

  test("AC-2: the canonical manifest is one line per member, sorted by code point, and the digest is its sha256", async () => {
    const stage = await staged();
    const { view } = await pinned();
    const manifest = [...(view.revisions[0] as DrawingSetView["revisions"][number]).manifest];

    const lines = manifest.map((member) => `${member.drawingId}\t${member.revisionId}\t${member.sha256}`);
    const canonical = byCodePoint(lines).join("\n");
    expect(stage.core.canonicalManifest(manifest), "the canonical form is one tab-separated line per member — drawing, revision, content — sorted by code point (L-REG-05: `localeCompare` is not a sort this tree makes)").toBe(canonical);
    expect(stage.core.manifestDigest(manifest), "and the digest is the lowercase-hex sha256 of exactly that text").toBe(sha256OfText(canonical));

    const module = await setsSeam();
    expect(module.canonicalManifest(manifest), "the takeoff module re-exports the core's canonical form rather than computing a second one (B-17: one home)").toBe(canonical);
    expect(module.manifestDigest(manifest), "and the core's address with it").toBe(sha256OfText(canonical));
  }, BUDGET_MS);
});
